export function planFeature(organization: any, feature: string, fallback = true) {
  const value = organization?.plan?.features?.[feature];
  return value === undefined || value === null ? fallback : Boolean(value);
}

export function planLimit(organization: any, limit: string) {
  return organization?.plan?.limits?.[limit];
}

export function planName(organization: any) {
  return organization?.plan?.name || 'plano atual';
}

export function planBlockedMessage(organization: any, resource: string) {
  return `Acao bloqueada pelo ${planName(organization)}. Este plano nao permite ${resource}. Para continuar, melhore o plano da organizacao.`;
}
