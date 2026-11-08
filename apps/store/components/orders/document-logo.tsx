// The logo at the top of an invoice or quotation, or the store's name when there's no logo. Dark mode shows the
// dark-background version on screen, but these pages print on white, so printing always takes the usual one.
export function DocumentLogo({ storeName, logoUrl, logoDarkUrl }: { storeName: string; logoUrl: string | null; logoDarkUrl: string | null }) {
  if (!logoUrl) return <p className="text-lg font-bold">{storeName}</p>

  const size = "h-auto max-h-7 w-auto max-w-full sm:max-h-10"
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- our own blob storage, not set up for next/image */}
      <img src={logoUrl} alt={storeName} className={logoDarkUrl ? `${size} dark:hidden dark:print:block` : size} />
      {/* eslint-disable-next-line @next/next/no-img-element -- as above */}
      {logoDarkUrl && <img src={logoDarkUrl} alt={storeName} className={`${size} hidden dark:block dark:print:hidden`} />}
    </>
  )
}
