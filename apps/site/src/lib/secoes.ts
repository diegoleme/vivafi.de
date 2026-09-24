import { ACTIVITY_KIND_LABELS, ACTIVITY_KINDS, type ActivityKind, type Parish } from '@vivafide/core';

/** Plurais onde o rótulo singular soaria errado num índice. */
const PLURAL: Partial<Record<ActivityKind, string>> = {
  mass: 'Missas', confession: 'Confissões', novena: 'Novenas', rosary: 'Terços',
  event: 'Eventos', 'prayer-group': 'Grupos de oração', ministry: 'Pastorais',
};

/**
 * Todas as seções da página, na ordem em que aparecem — incluindo "Onde fica"
 * e "Contato", que são justamente os destinos mais procurados por quem chega
 * sabendo o que quer.
 */
export function secoesDaPagina(parish: Parish): { href: string; titulo: string }[] {
  const tipos = ACTIVITY_KINDS.filter((k) =>
    parish.communities.some((c) => c.activities.some((a) => a.kind === k)),
  ).map((k) => ({ href: `#tipo-${k}`, titulo: PLURAL[k] ?? ACTIVITY_KIND_LABELS[k] }));

  const c = parish.contact ?? {};
  const temSecretaria = parish.officeHours.length > 0 || Boolean(c.phone || c.whatsapp || c.email);
  // Redes não entra no índice: sem título de seção, não há âncora — e os
  // links de marca ficam logo acima do rodapé, onde se procura por eles.
  return [
    ...tipos,
    { href: '#t-enderecos', titulo: parish.communities.length === 1 ? 'Endereço' : 'Endereços' },
    ...(temSecretaria ? [{ href: '#t-secretaria', titulo: 'Secretaria' }] : []),
  ];
}
