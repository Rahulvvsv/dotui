// Using a Babel config opts the app out of SWC so the dotUI plugin can stamp
// every dot.* element with the same structural id that `dotui build` records.
const { dotuiBabelPlugin } = require('@dotui/compiler');

module.exports = {
  presets: ['next/babel'],
  plugins: [dotuiBabelPlugin],
};
