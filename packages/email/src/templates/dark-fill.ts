// Gmail's apps in dark mode recolour an email's background and text colours but leave its images alone, so the dark
// header turned light under the white logo. A one-colour gradient is an image, which keeps the header dark there; every
// other client draws the same colour as before. Only for what holds an image: on text Gmail would keep the background
// and still darken the text, so buttons are left to Gmail, which flips their background and text together.
export const DARK_FILL = { backgroundImage: "linear-gradient(#18181b, #18181b)" }
