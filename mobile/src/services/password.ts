// Mesmas regras da API, inclusive o limite em bytes usado pelo bcrypt.
export function passwordError(password: string): string | null {
  let bytes = 0;
  for (const character of password) {
    const code = character.codePointAt(0)!;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  if (password.length < 8 || bytes > 72) return 'Use uma senha de pelo menos 8 caracteres e até 72 bytes.';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) return 'Inclua letras maiúsculas e minúsculas na senha.';
  if (!/[0-9]/.test(password)) return 'A senha deve conter pelo menos um número.';
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return 'A senha deve conter pelo menos um caractere especial (!@#$%^&*).';
  return null;
}
