/**
 * A URL universal do Google Maps abre o app no celular e o site no desktop, e
 * funciona a partir do endereço em texto — `geo:` só valeria no Android, e
 * coordenada nós raramente temos.
 */
export function mapsUrl(address: string[], location?: { lat: number; lng: number }): string {
  // Travessão e bolinha atrapalham a geocodificação; vírgula funciona melhor.
  const q = location
    ? `${location.lat},${location.lng}`
    : address.join(', ').replace(/\s+[—·]\s+/g, ', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** `+551146814187` → `(11) 4681-4187`. Fora do Brasil, mostra como está. */
export function formatPhone(e164: string): string {
  const m = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

export const whatsappUrl = (e164: string) => `https://wa.me/${e164.replace(/\D/g, '')}`;
export const telUrl = (e164: string) => `tel:${e164}`;
