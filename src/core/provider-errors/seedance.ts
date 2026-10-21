import type { Rule } from './types'
import { matchedSubject, settingTitle } from './helpers'

export const SEEDANCE_RULES: readonly Rule[] = [
  {
    match: /InputImageSensitiveContentDetected\.PrivacyInformation/,
    title: 'Seedance blocks images that look like real people, even AI-made ones.',
    hint: 'Use Wan 3.0 for this reference, or a stylized character.',
    kind: 'real_person',
  },
  {
    match: /InputVideoSensitiveContentDetected\.PrivacyInformation/,
    title: 'Seedance blocks videos that show real people.',
    hint: 'Use Wan 3.0 for this reference.',
    kind: 'real_person',
  },
  {
    match: /Input(?:Image|Video|Audio|Text)SensitiveContentDetected\.PolicyViolation/,
    title: (raw) => {
      const subject = matchedSubject(raw, /Input(Image|Video|Audio|Text)SensitiveContentDetected/)
      return `Your ${subject ?? 'input'} may be copyrighted.`
    },
    hint: 'Remove brands, known characters or known works.',
    kind: 'copyright',
  },
  {
    match: /Output(?:Image|Video|Audio)?SensitiveContentDetected\.PolicyViolation/,
    title: 'The result looked like copyrighted material and was blocked.',
    hint: 'Change the prompt and try again.',
    kind: 'copyright',
  },
  {
    match: /InputTextSensitiveContentDetected/,
    title: "Seedance's content check flagged your prompt.",
    hint: 'Rephrase it and try again.',
    kind: 'content',
  },
  {
    match: /Input(?:Image|Video|Audio)SensitiveContentDetected/,
    title: (raw) => {
      const subject = matchedSubject(raw, /Input(Image|Video|Audio)SensitiveContentDetected/)
      return `Seedance's content check flagged a reference ${subject ?? 'file'}.`
    },
    hint: 'Replace it and try again.',
    kind: 'content',
  },
  {
    match: /Output(?:Video|Audio)SensitiveContentDetected/,
    title: "The finished video was blocked by Seedance's content check.",
    hint: 'Change the prompt or the seed.',
    kind: 'content',
  },
  {
    match: /SensitiveContentDetected/,
    title: "Seedance's content check flagged this request.",
    hint: 'Change the prompt or references.',
    kind: 'content',
  },
  {
    match: /InvalidImageURL\.InvalidFormat/,
    title: 'Seedance could not read one of the images.',
    hint: 'Save it again as JPEG or PNG.',
    kind: 'input',
  },
  {
    match: /InvalidParameter\.(?:TaskTypeConstraint|TaskTypeMismatch)/,
    title: 'Seedance does not accept this mix of frames and references.',
    hint: 'Use frames or references, not both.',
    kind: 'input',
  },
  {
    match: /InvalidParameter|MissingParameter/,
    title: (raw) => settingTitle('Seedance', raw),
    hint: 'The app should have caught this. Send the details to the developer.',
    kind: 'input',
  },
  {
    match: /RateLimitExceeded|QuotaExceeded|InflightBatchsizeExceeded|ServerOverloaded|RequestBurstTooFast|FlowLimitExceeded/,
    title: 'Seedance is busy right now.',
    hint: 'Try again in a few minutes.',
    kind: 'busy',
    retry: true,
  },
  {
    match: /InternalError|InternalServiceError|FailToConnect|ServiceUnavailableTemp|InternalServiceTimeout/,
    title: 'Seedance had an internal error.',
    hint: 'Try again.',
    kind: 'provider',
    retry: true,
  },
]

