// Plain functions with no React, so server code (schemas used by server actions) can import them.
// Uses the "min" metadata, the same set react-phone-number-input's input uses, so client and server agree.
export { isPossiblePhoneNumber } from "libphonenumber-js/min"
