/** Logo del centro: el sello en las pantallas de entrada y el logotipo en una línea en las cabeceras. */
export function Marca({ grande = false }: { grande?: boolean }) {
  return grande ? (
    // eslint-disable-next-line @next/next/no-img-element -- imagen pequeña y fija, sin optimizar
    <img src="/sello.png" alt="Adela María · Belleza holística" width={160} height={160} className="mx-auto size-40" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- imagen pequeña y fija, sin optimizar
    <img src="/logotipo.png" alt="Adela María · Belleza holística" width={129} height={40} className="h-10 w-auto" />
  );
}
