import { localDay, previousDay } from '../config/runtime.js';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../config/database.js';
import { generateToken, UserRole } from '../middleware/auth.js';
import { validVerificationProof } from '../services/verificationProof.js';

const emailValid = (value: unknown): value is string => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.trim().length <= 254;
const privateUserFields = new Set(['password_hash', 'verification_code', 'verification_code_expires_at', 'parent_consent_code', 'session_version']);
const publicUser = (user: any) => Object.fromEntries(Object.entries(user).filter(([key]) => !privateUserFields.has(key)));
function uniqueHandle(preferred: string) {
  let handle = preferred;
  while (db.prepare('SELECT id FROM users WHERE LOWER(username_handle) = ?').get(handle.toLowerCase())) handle = preferred + '.' + crypto.randomBytes(4).toString('hex');
  return handle;
}
function emailProof(email: string, token: unknown) {
  const record = db.prepare('SELECT * FROM email_verifications WHERE email = ?').get(email);
  return validVerificationProof(token, 'registration-email', email, record);
}
function consentProof(phone: string, name: string, token: unknown) {
  const cleanPhone = phone.replace(/\D/g, '');
  const record = db.prepare('SELECT * FROM parental_consents WHERE parent_phone = ?').get(cleanPhone);
  return validVerificationProof(token, 'parental-consent', cleanPhone, record, name);
}

// Validação de senha forte (mínimo 8 caracteres, letras, números e caracteres especiais)
export function validateStrongPassword(password: string): { valid: boolean; reason?: string } {
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    return { valid: false, reason: 'Use uma senha de pelo menos 8 caracteres e até 72 bytes.' };
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    return { valid: false, reason: 'Inclua letras maiúsculas e minúsculas na senha.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, reason: 'A senha deve conter pelo menos um número.' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, reason: 'A senha deve conter pelo menos um caractere especial (!@#$%^&*).' };
  }
  return { valid: true };
}

// Cálculo do percentual de conclusão do perfil (0 a 100%)
export function calculateProfileCompletion(userData: {
  name?: string;
  last_name?: string;
  username_handle?: string;
  avatar_url?: string;
  age?: number;
  parent_phone?: string;
  parent_consent_verified?: number;
  address_street?: string;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
  email_verified?: number;
}): { percent: number; missing: string[] } {
  let score = 0;
  const missing: string[] = [];

  // 1. Nome e Sobrenome (20%)
  if (userData.name && userData.name.trim() && userData.last_name && userData.last_name.trim()) {
    score += 20;
  } else {
    missing.push('Sobrenome completo');
  }

  // 2. Handle / Nome de usuário (@handle) (15%)
  if (userData.username_handle && userData.username_handle.trim()) {
    score += 15;
  } else {
    missing.push('Nome de usuário (@handle)');
  }

  // 3. E-mail verificado (2FA) (20%)
  if (userData.email_verified) {
    score += 20;
  } else {
    missing.push('Validação de e-mail (2FA)');
  }

  // 4. Foto de Perfil (15%)
  if (userData.avatar_url && !userData.avatar_url.includes('ui-avatars.com')) {
    score += 15;
  } else {
    missing.push('Foto de perfil no caderno ou avatar');
  }

  // 5. Idade & Responsável se < 18 (15%)
  const age = Number(userData.age) || 0;
  if (age > 0) {
    if (age < 18) {
      if (userData.parent_phone && userData.parent_consent_verified) {
        score += 15;
      } else {
        missing.push('Autorização dos pais via WhatsApp');
      }
    } else {
      score += 15;
    }
  } else {
    missing.push('Idade');
  }

  // 6. Endereço completo (15%)
  if (userData.address_street?.trim() && userData.address_neighborhood?.trim() && userData.address_city?.trim() && userData.address_state?.trim()) {
    score += 15;
  } else {
    missing.push('Endereço completo (Rua, Bairro, Cidade, Estado)');
  }

  return {
    percent: Math.min(100, score),
    missing,
  };
}

// 1. Solicitar código de verificação 2FA (6 dígitos) para e-mail
export const register = async (req: Request, res: Response) => {
  try {
    const {
      name,
      lastName,
      email,
      password,
      confirmPassword,
      usernameHandle,
      age,
      parentPhone,
      parentConsentToken,
      addressStreet,
      addressNeighborhood,
      addressCity,
      addressState,
      addressZipcode,
      avatarUrl,
      churchCode,
      emailVerificationToken,
    } = req.body;

    if (!name?.trim() || name.length > 100 || !emailValid(email) || !password) {
      return res.status(400).json({ error: 'Preencha os campos obrigatórios (nome, email e senha).' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'Este e-mail já está cadastrado. Faça login para acessar.' });
    }

    // Validação de senha
    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ error: 'A confirmação de senha não confere com a senha digitada.' });
    }
    const pwdValidation = validateStrongPassword(password);
    if (!pwdValidation.valid) {
      return res.status(400).json({ error: pwdValidation.reason });
    }

    // Regra de menor de idade (< 18 anos)
    const numAge = Number(age);
    if (!['number', 'string'].includes(typeof age) || !Number.isInteger(numAge) || numAge < 1 || numAge > 120) return res.status(400).json({ error: 'Informe uma idade válida.' });
    let parentVerified = 0;
    if (numAge > 0 && numAge < 18) {
      if (!parentPhone) {
        return res.status(400).json({ error: 'Para menores de 18 anos, o telefone do pai/responsável é obrigatório.' });
      }
      if (consentProof(parentPhone, name, parentConsentToken)) parentVerified = 1;
      else return res.status(400).json({ error: 'A autorização do responsável precisa ser confirmada.' });
    }

    // Formatação de Handle (@handle)
    let formattedHandle = usernameHandle ? usernameHandle.trim().toLowerCase() : `@${name.toLowerCase().replace(/\s+/g, '.')}`;
    if (!formattedHandle.startsWith('@')) {
      formattedHandle = `@${formattedHandle}`;
    }

    // Garantir handle único

    // Verificar se e-mail foi validado por 2FA
    if (!emailProof(cleanEmail, emailVerificationToken)) return res.status(400).json({ error: 'Confirme seu e-mail antes de concluir o cadastro.' });
    const emailVerified = 1;

    // Vincular à igreja caso fornecido código
    let church: any = null;
    if (churchCode && churchCode.trim()) {
      church = db.prepare('SELECT * FROM churches WHERE UPPER(slug_code) = UPPER(?)').get(churchCode.trim());
    }

    const userId = `usr-${crypto.randomUUID()}`;
    const passwordHash = await bcrypt.hash(password, 10);
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail)) return res.status(409).json({ error: 'Este e-mail já está cadastrado. Faça login para acessar.' });
    if (!emailProof(cleanEmail, emailVerificationToken)) return res.status(400).json({ error: 'Confirme seu e-mail antes de concluir o cadastro.' });
    if (parentVerified && !consentProof(parentPhone, name, parentConsentToken)) return res.status(400).json({ error: 'Confirme novamente a autorização do responsável.' });
    formattedHandle = uniqueHandle(formattedHandle);
    const now = new Date().toISOString();
    if (churchCode && !church) return res.status(400).json({ error: 'Código de igreja inválido.' });
    const defaultAvatar = avatarUrl || '';

    // Calcular percentual do perfil
    const completionData = {
      name: name.trim(),
      last_name: lastName ? lastName.trim() : '',
      username_handle: formattedHandle,
      avatar_url: avatarUrl || undefined,
      age: numAge,
      parent_phone: parentPhone || undefined,
      parent_consent_verified: parentVerified,
      address_street: addressStreet || undefined,
      address_neighborhood: addressNeighborhood || undefined,
      address_city: addressCity || undefined,
      address_state: addressState || undefined,
      email_verified: emailVerified,
    };
    const { percent, missing } = calculateProfileCompletion(completionData);

    // Se atingiu 100%, concede bônus inicial de +100 pontos
    let bonusPoints = 0;
    let bonusAwarded = 0;
    if (percent === 100) {
      bonusPoints = 100;
      bonusAwarded = 1;
    }

    db.transaction(() => {
      db.prepare(`
        INSERT INTO users (
          id, church_id, name, last_name, username_handle, age, parent_phone,
          parent_consent_verified, email, email_verified, password_hash,
          address_street, address_neighborhood, address_city, address_state, address_zipcode,
          profile_completion_percent, profile_bonus_awarded, role,
          current_streak, highest_streak, total_points, avatar_url, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'member', 0, 0, ?, ?, ?)
      `).run(
        userId,
        church ? church.id : null,
        name.trim(),
        lastName ? lastName.trim() : null,
        formattedHandle,
        numAge || null,
        parentPhone ? parentPhone.trim() : null,
        parentVerified,
        cleanEmail,
        emailVerified,
        passwordHash,
        addressStreet ? addressStreet.trim() : null,
        addressNeighborhood ? addressNeighborhood.trim() : null,
        addressCity ? addressCity.trim() : null,
        addressState ? addressState.trim() : null,
        addressZipcode ? addressZipcode.trim() : null,
        percent,
        bonusAwarded,
        bonusPoints,
        defaultAvatar,
        now
      );

      // Se ganhou bônus de 100%, registrar no histórico de pontos
      if (bonusAwarded === 1 && church) {
        db.prepare(`
          INSERT INTO point_history (id, church_id, user_id, amount, reason, created_at)
          VALUES (?, ?, ?, 100, 'Bônus de Cadastro Completo (100%)', ?)
        `).run(`ph-${crypto.randomUUID()}`, church.id, userId, now);
      }

      // Se foi vinculado a uma igreja, ingressar automaticamente no primeiro grupo de estudo
      if (church) {
        const firstGroup = db.prepare('SELECT id FROM groups WHERE church_id = ? ORDER BY created_at ASC LIMIT 1').get(church.id) as { id: string } | undefined;
        if (firstGroup) {
          db.prepare(`
            INSERT INTO group_members (id, group_id, user_id, joined_at)
            VALUES (?, ?, ?, ?)
          `).run(`gm-${crypto.randomUUID()}`, firstGroup.id, userId, now);
        }
      }

      db.prepare('DELETE FROM email_verifications WHERE email = ?').run(cleanEmail);
      if (parentVerified) db.prepare('DELETE FROM parental_consents WHERE parent_phone = ?').run(parentPhone.replace(/\D/g, ''));
    })();

    const token = generateToken({
      id: userId,
      church_id: church ? church.id : '',
      name: name.trim(),
      email: cleanEmail,
      role: 'member' as UserRole,
    });

    return res.status(201).json({
      message: bonusAwarded ? 'Parabéns! Cadastro 100% completo com bônus de +100 pontos resgatado!' : 'Cadastro realizado com sucesso!',
      token,
      bonus_awarded: bonusAwarded === 1,
      profile_completion_percent: percent,
      missing_fields: missing,
      user: {
        id: userId,
        church_id: church ? church.id : null,
        church_name: church ? church.name : null,
        church_code: church ? church.slug_code : null,
        name: name.trim(),
        last_name: lastName ? lastName.trim() : null,
        username_handle: formattedHandle,
        email: cleanEmail,
        role: 'member',
        current_streak: 0,
        total_points: bonusPoints,
        avatar_url: defaultAvatar,
        profile_completion_percent: percent,
        profile_bonus_awarded: bonusAwarded === 1,
      },
    });
  } catch (err: any) {
    console.error('Erro no registro:', err);
    return res.status(500).json({ error: 'Erro interno ao realizar cadastro.' });
  }
};

// 6. Atualizar Perfil e Resgatar Bônus de 100% (se faltava preencher algo)
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Não autorizado.' });
    }

    const currentUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!currentUser) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const {
      name,
      lastName,
      usernameHandle,
      age,
      parentPhone,
      parentConsentToken,
      addressStreet,
      addressNeighborhood,
      addressCity,
      addressState,
      addressZipcode,
      avatarUrl,
    } = req.body;

    const newName = name !== undefined ? name.trim() : currentUser.name;
    const newLastName = lastName !== undefined ? lastName.trim() : currentUser.last_name;
    let newHandle = usernameHandle !== undefined ? usernameHandle.trim().toLowerCase() : currentUser.username_handle;
    if (newHandle && !newHandle.startsWith('@')) {
      newHandle = `@${newHandle}`;
    }

    const newAge = age !== undefined ? Number(age) : currentUser.age;
    if (!newName || newName.length > 100 || (age !== undefined && (!['number', 'string'].includes(typeof age) || !Number.isInteger(newAge) || newAge < 1 || newAge > 120))) return res.status(400).json({ error: 'Confira o nome e a idade.' });
    if (newHandle && db.prepare('SELECT id FROM users WHERE LOWER(username_handle) = ? AND id != ?').get(newHandle, userId)) return res.status(409).json({ error: 'Este nome de usuário já está em uso.' });
    const newParentPhone = parentPhone !== undefined ? parentPhone.trim() : currentUser.parent_phone;
    let parentVerified = currentUser.parent_consent_verified;
    let consumeConsent = false;
    const identityChanged = newName.toLowerCase() !== currentUser.name.toLowerCase()
      || (newParentPhone || '').replace(/\D/g, '') !== (currentUser.parent_phone || '').replace(/\D/g, '');
    if (identityChanged) parentVerified = 0;
    if (newAge > 0 && newAge < 18) {
      if (!parentVerified || identityChanged || !currentUser.age || currentUser.age >= 18) {
        if (!newParentPhone || !consentProof(newParentPhone, newName, parentConsentToken)) return res.status(400).json({ error: 'Confirme a autorização do responsável para atualizar o perfil de menor.' });
        parentVerified = 1;
        consumeConsent = true;
      }
    } else parentVerified = 0;

    const newAvatar = avatarUrl !== undefined ? avatarUrl : currentUser.avatar_url;
    const newStreet = addressStreet !== undefined ? addressStreet.trim() : currentUser.address_street;
    const newNeighborhood = addressNeighborhood !== undefined ? addressNeighborhood.trim() : currentUser.address_neighborhood;
    const newCity = addressCity !== undefined ? addressCity.trim() : currentUser.address_city;
    const newState = addressState !== undefined ? addressState.trim() : currentUser.address_state;
    const newZip = addressZipcode !== undefined ? addressZipcode.trim() : currentUser.address_zipcode;

    // Recalcular percentual
    const { percent, missing } = calculateProfileCompletion({
      name: newName,
      last_name: newLastName,
      username_handle: newHandle,
      avatar_url: newAvatar,
      age: newAge,
      parent_phone: newParentPhone,
      parent_consent_verified: parentVerified,
      address_street: newStreet,
      address_neighborhood: newNeighborhood,
      address_city: newCity,
      address_state: newState,
      email_verified: currentUser.email_verified,
    });

    let pointsBonus = 0;
    let bonusAwardedNow = false;
    let newTotalPoints = currentUser.total_points;
    let newBonusAwarded = currentUser.profile_bonus_awarded;

    // Se completou 100% agora e ainda não recebeu o bônus
    if (percent === 100 && currentUser.profile_bonus_awarded === 0) {
      pointsBonus = 100;
      newTotalPoints += 100;
      newBonusAwarded = 1;
      bonusAwardedNow = true;

      const now = new Date().toISOString();
      if (currentUser.church_id) {
        db.prepare(`
          INSERT INTO point_history (id, church_id, user_id, amount, reason, created_at)
          VALUES (?, ?, ?, 100, 'Bônus de Cadastro Completo (100%)', ?)
        `).run(`ph-${crypto.randomUUID()}`, currentUser.church_id, userId, now);
      }
    }

    db.prepare(`
      UPDATE users SET
        name = ?,
        last_name = ?,
        username_handle = ?,
        age = ?,
        parent_phone = ?,
        parent_consent_verified = ?,
        avatar_url = ?,
        address_street = ?,
        address_neighborhood = ?,
        address_city = ?,
        address_state = ?,
        address_zipcode = ?,
        profile_completion_percent = ?,
        profile_bonus_awarded = ?,
        total_points = ?
      WHERE id = ?
    `).run(
      newName,
      newLastName,
      newHandle,
      newAge,
      newParentPhone,
      parentVerified,
      newAvatar,
      newStreet,
      newNeighborhood,
      newCity,
      newState,
      newZip,
      percent,
      newBonusAwarded,
      newTotalPoints,
      userId
    );

    if (consumeConsent) db.prepare('DELETE FROM parental_consents WHERE parent_phone = ?').run(newParentPhone.replace(/\D/g, ''));

    return res.json({
      message: bonusAwardedNow
        ? '🎉 Glória a Deus! Você completou 100% do seu cadastro e ganhou +100 pontos de bônus!'
        : 'Perfil atualizado com sucesso!',
      bonus_awarded_now: bonusAwardedNow,
      profile_completion_percent: percent,
      missing_fields: missing,
      user: {
        ...publicUser(currentUser),
        parent_phone: newParentPhone,
        parent_consent_verified: parentVerified,
        name: newName,
        last_name: newLastName,
        username_handle: newHandle,
        avatar_url: newAvatar,
        age: newAge,
        address_street: newStreet,
        address_neighborhood: newNeighborhood,
        address_city: newCity,
        address_state: newState,
        address_zipcode: newZip,
        profile_completion_percent: percent,
        profile_bonus_awarded: newBonusAwarded === 1,
        total_points: newTotalPoints,
      },
    });
  } catch (err: any) {
    console.error('Erro em updateProfile:', err);
    return res.status(500).json({ error: 'Erro ao atualizar dados do perfil.' });
  }
};

// 7. Esqueci Minha Senha - Enviar código de 6 dígitos
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, code, newPassword, confirmPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'E-mail, código e nova senha são obrigatórios.' });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'A confirmação de senha não confere.' });
    }

    const pwdCheck = validateStrongPassword(newPassword);
    if (!pwdCheck.valid) {
      return res.status(400).json({ error: pwdCheck.reason });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT id, verification_code, verification_code_expires_at FROM users WHERE email = ?').get(cleanEmail) as any;

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    if (!user.verification_code || user.verification_code !== code.toString().trim()) {
      return res.status(400).json({ error: 'Código de 6 dígitos incorreto.' });
    }

    if (user.verification_code_expires_at && new Date() > new Date(user.verification_code_expires_at)) {
      return res.status(400).json({ error: 'Código expirado. Solicite um novo código de recuperação.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    const changed = db.prepare(`
      UPDATE users SET password_hash = ?, verification_code = NULL, verification_code_expires_at = NULL, session_version = session_version + 1
      WHERE id = ? AND verification_code = ? AND verification_code_expires_at > ?
    `).run(newHash, user.id, code.toString().trim(), new Date().toISOString());
    if (!changed.changes) return res.status(400).json({ error: 'Código inválido, expirado ou já utilizado.' });

    return res.json({
      message: 'Sua senha foi redefinida com sucesso! Você já pode fazer login com a nova senha.',
    });
  } catch (err: any) {
    console.error('Erro em resetPassword:', err);
    return res.status(500).json({ error: 'Erro ao redefinir senha.' });
  }
};

// 9. Cadastro Divergente de Igreja com Boas-Vindas ao Pastor e CNPJ Opcional
export const registerChurch = async (req: Request, res: Response) => {
  try {
    const {
      churchName,
      denomination,
      cnpj,
      city,
      state,
      addressFull,
      phone,
      pastorName,
      email,
      password,
      emailVerificationToken,
    } = req.body;

    if (!churchName?.trim() || churchName.length > 200 || !pastorName?.trim() || pastorName.length > 100 || !emailValid(email) || !password) {
      return res.status(400).json({ error: 'Nome da igreja, nome do pastor, e-mail e senha são obrigatórios.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'Este e-mail pastoral já está cadastrado no sistema.' });
    }

    const pwdCheck = validateStrongPassword(password);
    if (!pwdCheck.valid) {
      return res.status(400).json({ error: pwdCheck.reason });
    }

    if (!emailProof(cleanEmail, emailVerificationToken)) return res.status(400).json({ error: 'Confirme seu e-mail antes de cadastrar a igreja.' });

    const churchId = `chu-${crypto.randomUUID()}`;
    let cleanSlug = (churchName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6) + '26').toUpperCase();
    const slugBase = cleanSlug;
    while (db.prepare('SELECT id FROM churches WHERE slug_code = ?').get(cleanSlug)) cleanSlug = slugBase + crypto.randomBytes(3).toString('hex').toUpperCase();

    const now = new Date().toISOString();
    const logoUrl = 'https://images.unsplash.com/photo-1548625361-19598285a815?w=200';

    const createTransaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO churches (id, name, slug_code, city, state, denomination, cnpj, phone, address_full, logo_url, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        churchId,
        churchName.trim(),
        cleanSlug,
        city || '',
        state || '',
        denomination || '',
        cnpj ? cnpj.trim() : null,
        phone ? phone.trim() : null,
        addressFull ? addressFull.trim() : null,
        logoUrl,
        now
      );

      const userId = `usr-${crypto.randomUUID()}`;
      const defaultAvatar = '';
      const passwordHash = bcrypt.hashSync(password, 10);
      const pastorHandle = uniqueHandle(`@pastor.${pastorName.trim().toLowerCase().replace(/\s+/g, '.')}`);
      const profilePercent = calculateProfileCompletion({ name: pastorName.trim(), username_handle: pastorHandle, email_verified: 1 }).percent;

      db.prepare(`
        INSERT INTO users (
          id, church_id, name, last_name, username_handle, email, email_verified,
          password_hash, role, current_streak, highest_streak, total_points,
          avatar_url, profile_completion_percent, profile_bonus_awarded, created_at
        ) VALUES (?, ?, ?, '', ?, ?, 1, ?, 'church_admin', 0, 0, 0, ?, ?, 0, ?)
      `).run(userId, churchId, pastorName.trim(), pastorHandle, cleanEmail, passwordHash, defaultAvatar, profilePercent, now);

      // Criar a temporada correspondente ao trimestre local de cadastro.
      const today = localDay();
      const year = Number(today.slice(0, 4));
      const quarterMonth = Math.floor((Number(today.slice(5, 7)) - 1) / 3) * 3;
      const startDate = new Date(Date.UTC(year, quarterMonth, 1)).toISOString().slice(0, 10);
      const endDate = new Date(Date.UTC(year, quarterMonth + 3, 0)).toISOString().slice(0, 10);
      const quarterId = `qtr-${crypto.randomUUID()}`;
      db.prepare(`
        INSERT INTO quarters (id, church_id, title, start_date, end_date, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, 1, ?)
      `).run(quarterId, churchId, `${quarterMonth / 3 + 1}º Trimestre - O Hábito da Palavra`, startDate, endDate, now);
      db.prepare('DELETE FROM email_verifications WHERE email = ?').run(cleanEmail);

      return { userId, churchId, cleanSlug, profilePercent };
    });

    const result = createTransaction();

    const whatsappShareText = `A paz do Senhor, irmãos da ${churchName.trim()}! Nosso aplicativo devocional já está disponível. Entre no app com o código da nossa congregação: ${result.cleanSlug}`;

    const token = generateToken({
      id: result.userId,
      church_id: result.churchId,
      name: pastorName.trim(),
      email: cleanEmail,
      role: 'church_admin' as UserRole,
    });

    return res.status(201).json({
      message: 'Igreja e perfil pastoral cadastrados com sucesso!',
      token,
      church: {
        id: result.churchId,
        name: churchName.trim(),
        slug_code: result.cleanSlug,
        cnpj: cnpj || null,
        invite_link: null,
        whatsapp_share_text: whatsappShareText,
      },
      user: {
        id: result.userId,
        name: pastorName.trim(),
        email: cleanEmail,
        role: 'church_admin',
        church_id: result.churchId,
        church_name: churchName.trim(),
        church_code: result.cleanSlug,
        profile_completion_percent: result.profilePercent,
        profile_bonus_awarded: false,
        total_points: 0,
      },
    });
  } catch (err: any) {
    console.error('Erro ao cadastrar igreja:', err);
    return res.status(500).json({ error: 'Erro interno ao cadastrar igreja.' });
  }
};

// 10. Vincular-se a uma Igreja via Código pós-login
export const joinChurchByCode = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Informe o código da congregação (ex: VIDEIRA26).' });
    }

    const church = db.prepare('SELECT * FROM churches WHERE UPPER(slug_code) = UPPER(?)').get(code.trim()) as any;
    if (!church) {
      return res.status(404).json({ error: 'Código de igreja não encontrado. Verifique com seu pastor ou líder.' });
    }

    if (req.user?.church_id && req.user.church_id !== church.id) return res.status(409).json({ error: 'Sua conta já pertence a outra igreja. Solicite a transferência ao administrador.' });
    db.prepare('UPDATE users SET church_id = ? WHERE id = ?').run(church.id, userId);

    // Ingressar no primeiro grupo da igreja se não estiver em nenhum
    const firstGroup = db.prepare('SELECT id FROM groups WHERE church_id = ? ORDER BY created_at ASC LIMIT 1').get(church.id) as { id: string } | undefined;
    if (firstGroup) {
      const alreadyMember = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(firstGroup.id, userId);
      if (!alreadyMember) {
        db.prepare(`
          INSERT INTO group_members (id, group_id, user_id, joined_at)
          VALUES (?, ?, ?, ?)
        `).run(`gm-${crypto.randomUUID()}`, firstGroup.id, userId, new Date().toISOString());
      }
    }

    return res.json({
      message: `Bem-vindo(a) à congregação ${church.name}!`,
      church: {
        id: church.id,
        name: church.name,
        slug_code: church.slug_code,
      },
    });
  } catch (err: any) {
    console.error('Erro em joinChurchByCode:', err);
    return res.status(500).json({ error: 'Erro ao vincular-se à congregação.' });
  }
};

// 11. Status da Batalha de Células do Usuário (Condicional)
export const getBattleStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const churchId = req.user?.church_id;

    // Verificar se o usuário participa de grupos com gincana ou desafio ativo
    const userGroups = db.prepare(`
      SELECT g.id, g.title, g.invite_code
      FROM groups g
      INNER JOIN group_members gm ON gm.group_id = g.id
      WHERE gm.user_id = ?
    `).all(userId) as any[];

    // Se o usuário não tem grupos, não tem batalha habilitada
    if (!userGroups || userGroups.length === 0) {
      return res.json({
        has_active_battle: false,
        reason: 'O usuário não está inscrito em nenhuma célula ou grupo de estudo.',
        user_groups: [],
      });
    }

    // Verificar se a igreja do usuário está em uma gincana inter-igrejas ativa
    let activeInterChallenge: any = null;
    if (churchId) {
      activeInterChallenge = db.prepare(`
        SELECT c.*
        FROM inter_church_challenges c
        INNER JOIN challenge_participants cp ON cp.challenge_id = c.id
        WHERE cp.church_id = ? AND c.status = 'active'
        LIMIT 1
      `).get(churchId);
    }

    // Considera batalha ativa se o usuário estiver em pelo menos 1 grupo ativo
    return res.json({
      has_active_battle: true,
      battle_title: activeInterChallenge ? activeInterChallenge.title : 'Batalha de Células Trimestral',
      battle_description: activeInterChallenge ? activeInterChallenge.description : 'Ranking interno das células da congregação.',
      user_groups: userGroups,
    });
  } catch (err: any) {
    console.error('Erro em getBattleStatus:', err);
    return res.status(500).json({ error: 'Erro ao verificar status da batalha de células.' });
  }
};

// 12. Login (Suporta E-mail ou @handle)
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Informe e-mail (ou @handle) e senha.' });
    }

    const cleanIdentifier = email.trim().toLowerCase();
    const withAt = cleanIdentifier.startsWith('@') ? cleanIdentifier : `@${cleanIdentifier}`;
    const withoutAt = cleanIdentifier.replace(/^@/, '');
    const selectUser = `SELECT u.*, c.name AS church_name, c.slug_code AS church_code, c.logo_url AS church_logo FROM users u LEFT JOIN churches c ON c.id = u.church_id`;
    const user = (db.prepare(selectUser + ' WHERE LOWER(u.email) = ?').get(cleanIdentifier)
      || db.prepare(selectUser + ' WHERE LOWER(u.username_handle) IN (?, ?, ?) ORDER BY u.created_at, u.id LIMIT 1').get(cleanIdentifier, withAt, withoutAt)
      || (!cleanIdentifier.includes('@') ? db.prepare(selectUser + ' WHERE LOWER(u.email) = ?').get(cleanIdentifier + '@igreja.com') : undefined)) as any;

    if (!user) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const current = db.prepare('SELECT password_hash, session_version FROM users WHERE id = ?').get(user.id) as any;
    if (!current || current.password_hash !== user.password_hash || current.session_version !== user.session_version) {
      return res.status(401).json({ error: 'Sua senha foi alterada. Entre novamente com a senha atual.' });
    }

    // Verificar quebra de streak
    const yesterday = previousDay();
    let streak = user.current_streak;
    if (user.last_devotional_date && user.last_devotional_date < yesterday) {
      streak = 0;
      db.prepare('UPDATE users SET current_streak = 0 WHERE id = ?').run(user.id);
    }

    const token = generateToken({
      id: user.id,
      church_id: user.church_id || '',
      name: user.name,
      email: user.email,
      role: user.role,
    }, user.session_version);

    return res.json({
      message: 'Login realizado com sucesso!',
      token,
      user: {
        id: user.id,
        church_id: user.church_id,
        church_name: user.church_name,
        church_code: user.church_code,
        name: user.name,
        last_name: user.last_name,
        username_handle: user.username_handle,
        email: user.email,
        role: user.role,
        current_streak: streak,
        highest_streak: user.highest_streak,
        total_points: user.total_points,
        avatar_url: user.avatar_url,
        profile_completion_percent: user.profile_completion_percent,
        profile_bonus_awarded: user.profile_bonus_awarded === 1,
      },
    });
  } catch (err: any) {
    console.error('Erro no login:', err);
    return res.status(500).json({ error: 'Erro interno ao realizar login.' });
  }
};

// 13. getMe - Perfil Completo com Status do Perfil 100% e Pendências
export const getMe = (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const user = db.prepare(`
      SELECT 
        u.*,
        c.name AS church_name, c.slug_code AS church_code, c.logo_url AS church_logo
      FROM users u
      LEFT JOIN churches c ON c.id = u.church_id
      WHERE u.id = ?
    `).get(userId) as any;

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const today = localDay();
    const completedToday = user.last_devotional_date === today;

    // Resumo de cupons ativos
    const activeCouponsCount = db.prepare("SELECT COUNT(*) as count FROM user_coupons WHERE user_id = ? AND status = 'active'").get(userId) as { count: number };
    const totalDevotionalsCount = db.prepare('SELECT COUNT(*) as count FROM devotionals WHERE user_id = ?').get(userId) as { count: number };
    const feedbacksCount = db.prepare('SELECT COUNT(*) as count FROM leader_feedbacks WHERE member_id = ?').get(userId) as { count: number };

    // Calcular percentual e itens faltantes dinamicamente
    const { percent, missing } = calculateProfileCompletion({
      name: user.name,
      last_name: user.last_name,
      username_handle: user.username_handle,
      avatar_url: user.avatar_url,
      age: user.age,
      parent_phone: user.parent_phone,
      parent_consent_verified: user.parent_consent_verified,
      address_street: user.address_street,
      address_neighborhood: user.address_neighborhood,
      address_city: user.address_city,
      address_state: user.address_state,
      email_verified: user.email_verified,
    });

    return res.json({
      ...publicUser(user),
      current_streak: user.last_devotional_date && user.last_devotional_date >= previousDay() ? user.current_streak : 0,
      profile_completion_percent: percent,
      profile_bonus_awarded: user.profile_bonus_awarded === 1,
      missing_profile_fields: missing,
      completed_today: completedToday,
      current_day: today,
      active_coupons_count: activeCouponsCount.count,
      total_devotionals_count: totalDevotionalsCount.count,
      feedbacks_count: feedbacksCount.count,
    });
  } catch (err: any) {
    console.error('Erro em getMe:', err);
    return res.status(500).json({ error: 'Erro ao buscar perfil.' });
  }
};

export { requestCode, verifyCode, forgotPassword, sendParentalConsent, verifyParentalConsent } from './verificationController.js';
