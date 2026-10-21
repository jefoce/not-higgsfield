#!/usr/bin/env bash
# Cross-compiles pinned GPL ffmpeg for x86_64 Windows on Linux with mingw-w64.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=versions.env
source "$SCRIPT_DIR/versions.env"

# Optional mirror. CI sets BUILD_SOURCES_URL; local builds go straight upstream.
BUILD_SOURCES_URL=${BUILD_SOURCES_URL:-}
if [[ -n "$BUILD_SOURCES_URL" ]]; then
  BUILD_SOURCES_URL=${BUILD_SOURCES_URL%/}
fi

PROFILE=full
TARGET=x86_64-pc-windows-msvc
OUT=""
SOURCES=""
CROSS=x86_64-w64-mingw32-

usage() {
  printf 'usage: %s [--target x86_64-pc-windows-msvc] [--out <dir>] [--sources <dir>] [--profile full|minimal]\n' "$(basename "$0")"
}

fail() {
  printf '[ffmpeg] error: %s\n' "$*" >&2
  exit 1
}

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

download_verify() {
  local expected=$1 dest=$2
  shift 2
  local url actual
  if [[ -f "$dest" && "$(sha256_of "$dest")" == "$expected" ]]; then
    printf '[ffmpeg] cached %s\n' "$(basename "$dest")"
    return
  fi

  rm -f "$dest" "$dest.part"
  for url in "$@"; do
    printf '[ffmpeg] download %s\n' "$url"
    if ! curl -fL --retry 3 --connect-timeout 20 -o "$dest.part" "$url"; then
      rm -f "$dest.part"
      continue
    fi
    actual=$(sha256_of "$dest.part")
    if [[ "$actual" != "$expected" ]]; then
      printf '[ffmpeg] sha256 mismatch for %s: expected %s, got %s\n' "$url" "$expected" "$actual" >&2
      rm -f "$dest.part"
      continue
    fi
    mv "$dest.part" "$dest"
    return
  done
  fail "no source matched sha256 for $(basename "$dest"): $expected"
}

while (($#)); do
  case "$1" in
    --target) TARGET=${2:?missing value for --target}; shift 2 ;;
    --out) OUT=${2:?missing value for --out}; shift 2 ;;
    --sources) SOURCES=${2:?missing value for --sources}; shift 2 ;;
    --profile) PROFILE=${2:?missing value for --profile}; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) fail "unknown argument: $1" ;;
  esac
done

[[ "$(uname -s)" == Linux ]] || fail "Windows cross-build must run on Linux"
[[ "$TARGET" == x86_64-pc-windows-msvc ]] || fail "unsupported target: $TARGET"

PROFILE_FILE="$SCRIPT_DIR/profile-$PROFILE.txt"
[[ -f "$PROFILE_FILE" ]] || fail "unknown profile: $PROFILE"
if grep -q -- '--enable-nonfree' "$PROFILE_FILE"; then
  fail "profile enables nonfree components"
fi

for tool in curl tar make pkg-config nasm \
  "${CROSS}gcc" "${CROSS}g++" "${CROSS}ar" "${CROSS}strip" "${CROSS}objdump"; do
  command -v "$tool" >/dev/null 2>&1 || fail "missing tool: $tool"
done

THREAD_MODEL=$("${CROSS}gcc" -v 2>&1 | sed -n 's/^Thread model: //p' | head -1)
if [[ "$THREAD_MODEL" != posix ]]; then
  fail "mingw gcc uses '$THREAD_MODEL' threads, need posix: sudo update-alternatives --set x86_64-w64-mingw32-gcc /usr/bin/x86_64-w64-mingw32-gcc-posix"
fi

CACHE_ROOT="${XDG_CACHE_HOME:-$HOME/.cache}/not-higgsfield-build/ffmpeg"
OUT=${OUT:-"$CACHE_ROOT/$FFMPEG_VERSION-$PROFILE/$TARGET"}
WORK=${FFMPEG_BUILD_WORK:-"$CACHE_ROOT/work/$FFMPEG_VERSION-$PROFILE-$TARGET"}
SRC="$WORK/src"
PREFIX="$WORK/prefix"
# The binary is copied, never installed. A fixed prefix keeps buildconf free of home paths.
FFMPEG_PREFIX=/opt/not-higgsfield-ffmpeg
JOBS=$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)

PROFILE_FLAGS=()
while IFS= read -r line; do
  line=${line%%#*}
  line=$(printf '%s' "$line" | tr -d '[:space:]')
  [[ -z "$line" ]] && continue
  PROFILE_FLAGS+=("$line")
done < "$PROFILE_FILE"

mkdir -p "$SRC" "$PREFIX" "$OUT"
DEST="$OUT/ffmpeg-$TARGET.exe"

copy_sources() {
  [[ -n "$SOURCES" ]] || return
  mkdir -p "$SOURCES"
  cp "$SRC/ffmpeg-$FFMPEG_VERSION.tar.xz" "$SRC/x264-$X264_COMMIT.tar.bz2" \
    "$SRC/zlib-$ZLIB_VERSION.tar.gz" "$SOURCES/"
  printf '[ffmpeg] sources copied %s\n' "$SOURCES"
}

check_imports() {
  local bin=$1 imports
  imports=$("${CROSS}objdump" -p "$bin" | sed -n 's/^[[:space:]]*DLL Name: //p' | tr -d '\r' | sort -u)
  printf '[ffmpeg] DLL imports\n'
  if [[ -n "$imports" ]]; then
    printf '%s\n' "$imports" | sed 's/^/  /'
  fi
  if printf '%s\n' "$imports" | grep -Eiq 'libwinpthread|libgcc|libstdc|libssp|zlib1\.dll|libx264'; then
    fail "non-system DLL import found"
  fi
}

FFMPEG_URLS=(
  "https://ffmpeg.org/releases/ffmpeg-$FFMPEG_VERSION.tar.xz"
)
X264_URLS=(
  "https://code.videolan.org/videolan/x264/-/archive/$X264_COMMIT/x264-$X264_COMMIT.tar.bz2"
)
# zlib.net only serves the current release, older ones live under fossils.
ZLIB_URLS=(
  "https://zlib.net/fossils/zlib-$ZLIB_VERSION.tar.gz"
  "https://github.com/madler/zlib/releases/download/v$ZLIB_VERSION/zlib-$ZLIB_VERSION.tar.gz"
)
if [[ -n "$BUILD_SOURCES_URL" ]]; then
  FFMPEG_URLS=("$BUILD_SOURCES_URL/ffmpeg-$FFMPEG_VERSION.tar.xz" "${FFMPEG_URLS[@]}")
  X264_URLS=("$BUILD_SOURCES_URL/x264-$X264_COMMIT.tar.bz2" "${X264_URLS[@]}")
  ZLIB_URLS=("$BUILD_SOURCES_URL/zlib-$ZLIB_VERSION.tar.gz" "${ZLIB_URLS[@]}")
fi

download_verify "$FFMPEG_SHA256" "$SRC/ffmpeg-$FFMPEG_VERSION.tar.xz" "${FFMPEG_URLS[@]}"
download_verify "$X264_SHA256" "$SRC/x264-$X264_COMMIT.tar.bz2" "${X264_URLS[@]}"
download_verify "$ZLIB_SHA256" "$SRC/zlib-$ZLIB_VERSION.tar.gz" "${ZLIB_URLS[@]}"

if [[ -f "$DEST" ]]; then
  check_imports "$DEST"
  copy_sources
  printf '[ffmpeg] cached binary %s\n' "$DEST"
  exit 0
fi

rm -rf "$WORK/ffmpeg" "$WORK/x264" "$WORK/zlib" "$WORK/zlib-$ZLIB_VERSION" "$PREFIX"
mkdir -p "$PREFIX/bin" "$PREFIX/include" "$PREFIX/lib"

tar -xJf "$SRC/ffmpeg-$FFMPEG_VERSION.tar.xz" -C "$WORK"
tar -xjf "$SRC/x264-$X264_COMMIT.tar.bz2" -C "$WORK"
tar -xzf "$SRC/zlib-$ZLIB_VERSION.tar.gz" -C "$WORK"
mv "$WORK/ffmpeg-$FFMPEG_VERSION" "$WORK/ffmpeg"
mv "$WORK/x264-$X264_COMMIT" "$WORK/x264"

printf '[ffmpeg] cross-build x264 %s\n' "$X264_COMMIT"
(
  cd "$WORK/x264"
  ./configure --host=x86_64-w64-mingw32 --cross-prefix="$CROSS" --prefix="$PREFIX" \
    --enable-static --disable-shared --disable-cli
)
make -C "$WORK/x264" -j"$JOBS"
make -C "$WORK/x264" install

printf '[ffmpeg] cross-build zlib %s\n' "$ZLIB_VERSION"
make -C "$WORK/zlib-$ZLIB_VERSION" -f win32/Makefile.gcc \
  PREFIX="$CROSS" BINARY_PATH="$PREFIX/bin" INCLUDE_PATH="$PREFIX/include" \
  LIBRARY_PATH="$PREFIX/lib" install

printf '[ffmpeg] cross-build ffmpeg %s (%s)\n' "$FFMPEG_VERSION" "$PROFILE"
(
  cd "$WORK/ffmpeg"
  PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig" PKG_CONFIG_LIBDIR="$PREFIX/lib/pkgconfig" \
    ./configure --prefix="$FFMPEG_PREFIX" --target-os=mingw32 --arch=x86_64 \
    --enable-cross-compile --cross-prefix="$CROSS" --pkg-config=pkg-config \
    --extra-ldflags="-static" "${PROFILE_FLAGS[@]}"
)
make -C "$WORK/ffmpeg" -j"$JOBS"

BIN="$WORK/ffmpeg/ffmpeg.exe"
[[ -f "$BIN" ]] || fail "ffmpeg build produced no binary"
"${CROSS}strip" "$BIN"

check_imports "$BIN"

cp "$BIN" "$DEST"
chmod +x "$DEST"

printf '[ffmpeg] binary %s\n' "$DEST"
printf '[ffmpeg] size %s\n' "$(du -h "$DEST" | cut -f1)"
printf '[ffmpeg] sources\n'
printf '  ffmpeg %s %s %s\n' "$FFMPEG_VERSION" "$FFMPEG_SHA256" "$SRC/ffmpeg-$FFMPEG_VERSION.tar.xz"
printf '  x264 %s %s %s\n' "$X264_COMMIT" "$X264_SHA256" "$SRC/x264-$X264_COMMIT.tar.bz2"
printf '  zlib %s %s %s\n' "$ZLIB_VERSION" "$ZLIB_SHA256" "$SRC/zlib-$ZLIB_VERSION.tar.gz"
