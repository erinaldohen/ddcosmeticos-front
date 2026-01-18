export const maskCNPJ = (value) => {
  return value
    .replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .substring(0, 18);
};

// ATUALIZADO: Máscara mais fluida
export const maskPhone = (value) => {
  if (!value) return "";

  // Remove tudo que não é dígito
  let r = value.replace(/\D/g, "");

  // Limita a 11 dígitos
  if (r.length > 11) r = r.substring(0, 11);

  // Se tiver mais de 10 dígitos, é CELULAR COM 9 DÍGITOS: (11) 91234-5678
  if (r.length > 10) {
    return r.replace(/^(\d\d)(\d{5})(\d{4}).*/, "($1) $2-$3");
  }

  // Se tiver até 10 dígitos:
  // PODE SER FIXO: (11) 1234-5678
  // OU CELULAR ANTIGO/INCOMPLETO: (11) 9123-4567
  if (r.length > 5) {
    return r.replace(/^(\d\d)(\d{4})(\d{0,4}).*/, "($1) $2-$3");
  }

  if (r.length > 2) {
    return r.replace(/^(\d\d)(\d{0,5})/, "($1) $2");
  }

  if (r.length > 0) {
    return r.replace(/^(\d*)/, "($1");
  }

  return r;
};

export const maskCEP = (value) => {
  return value
    .replace(/\D/g, '')
    .replace(/^(\d{5})(\d)/, '$1-$2')
    .substring(0, 9);
};

export const unmask = (value) => {
  return value ? value.replace(/\D/g, '') : '';
};