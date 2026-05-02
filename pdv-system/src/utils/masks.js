export const maskCNPJ = (value) => {
    if (!value) return '';
    // A Receita Federal vai manter a pontuação e os 14 caracteres.
    // As letras entram nas posições da raiz (os 8 primeiros dígitos).
    let v = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (v.length > 14) v = v.substring(0, 14);

    return v.replace(/^([A-Z0-9]{2})([A-Z0-9]{3})([A-Z0-9]{3})([A-Z0-9]{4})([A-Z0-9]{2})/, "$1.$2.$3/$4-$5");
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