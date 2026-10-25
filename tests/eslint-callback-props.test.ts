import { type Rule, RuleTester } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, it } from 'vitest'

import rule from '../eslint-rules/callback-props.mjs'

RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  },
})

tester.run('callback-props', rule as Rule.RuleModule, {
  valid: [
    {
      name: 'passes a props callback through',
      code: 'function Comp(props) { return <button onClick={props.onClose} /> }',
    },
    {
      name: 'passes a setter from state',
      code: `function Comp() {
  const [isOpen, setIsOpen] = useState(false)
  return <button onOpenChange={setIsOpen} />
}`,
    },
    {
      name: 'passes a locally created handler',
      code: `function Comp() {
  const handleSave = () => {}
  return <button onClick={handleSave} />
}`,
    },
    {
      name: 'destructures a callback used only inside useCallback',
      code: `function Comp(props) {
  const { onSelect } = props
  const handleSelect = useCallback(() => onSelect(), [onSelect])
  return <button onClick={handleSelect} />
}`,
    },
  ],
  invalid: [
    {
      name: 'rejects an alias constant',
      code: `function Comp(props) {
  const handleClose = props.onClose
  return <button onClick={handleClose} />
}`,
      errors: [{ messageId: 'alias' }],
    },
    {
      name: 'rejects a destructured callback used in JSX',
      code: `function Comp(props) {
  const { onClose } = props
  return <button onClick={onClose} />
}`,
      errors: [{ messageId: 'destructured' }],
    },
    {
      name: 'rejects a renamed destructure',
      code: `function Comp(props) {
  const { onClose: handleClose } = props
  return <button onClick={handleClose} />
}`,
      errors: [{ messageId: 'renamed' }],
    },
    {
      name: 'rejects a created function without the handle prefix',
      code: `function Comp() {
  const save = () => {}
  return <button onClick={save} />
}`,
      errors: [{ messageId: 'handlerName' }],
    },
    {
      name: 'rejects an alias of a callback parameter',
      code: `function usePicker(onSelect) {
  const select = onSelect
  return <button onSelect={select} />
}`,
      errors: [{ messageId: 'alias' }],
    },
  ],
})
