import assert from 'node:assert/strict';
import type Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import { jwtSecret, localDay } from './config/runtime.js';

// Executado com outro createApp() pelo runner: mantém o limite real de tentativas.
export async function runAuthRegression(base: string, db: Database.Database) {
  let checks = 0;
  let mutations = 0;
  function check(label: string, assertion: () => void) {
    assertion(); checks++; console.log('✓ ' + label);
  }
  async function request(url: string, body?: object, token = '') {
    if (body) mutations++;
    const response = await fetch(base + '/api/auth' + url, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() as any, headers: response.headers };
  }
  const password = 'AuditoriaSegura@2026';
  const email = 'auth.regressao@comunhao.example';
  const payload = { name: 'Auditoria', age: 30, email, password, usernameHandle: '@auditoria.regressao' };
  const generated = await request('/request-code', { email });
  check('Código de cadastro tem validade e seis dígitos', () => {
    assert.equal(generated.status, 200);
    assert.match(generated.data.dev_code, /^\d{6}$/);
    assert.ok(Date.parse(generated.data.expires_at) > Date.now());
  });
  const verified = await request('/verify-code', { email, code: generated.data.dev_code });
  const originalProof = verified.data.verificationToken;
  check('Verificação entrega prova de confirmação ao solicitante', () => {
    assert.equal(verified.status, 200); assert.equal(typeof originalProof, 'string');
  });
  let result = await request('/register', payload);
  check('Confirmação de outro cliente não libera cadastro sem a prova', () => assert.equal(result.status, 400));

  // Cria uma segunda verificação válida para provar a vinculação ao e-mail,
  // sem depender de um servidor SMTP nem consumir tentativas extras de envio.
  const foreignEmail = 'outro.auth@comunhao.example';
  const record = db.prepare('SELECT * FROM email_verifications WHERE email = ?').get(email) as any;
  db.prepare('INSERT INTO email_verifications (email,code,expires_at,verified,created_at) VALUES (?,?,?,?,?)')
    .run(foreignEmail, record.code, record.expires_at, 1, record.created_at);
  result = await request('/register', { ...payload, email: foreignEmail, emailVerificationToken: originalProof });
  check('Prova de um e-mail não cadastra outro e-mail verificado', () => assert.equal(result.status, 400));

  db.prepare('UPDATE email_verifications SET expires_at = ? WHERE email = ?').run('2000-01-01T00:00:00.000Z', email);
  result = await request('/register', { ...payload, emailVerificationToken: originalProof });
  check('Prova de confirmação vencida não conclui cadastro', () => assert.equal(result.status, 400));
  db.prepare('UPDATE email_verifications SET expires_at = ? WHERE email = ?').run(record.expires_at, email);
  result = await request('/register', { ...payload, emailVerificationToken: originalProof + 'alterado' });
  check('Prova de confirmação adulterada é rejeitada', () => assert.equal(result.status, 400));
  result = await request('/register', { ...payload, password: 'fraca', emailVerificationToken: originalProof });
  check('Cadastro rejeita senha fraca sem consumir confirmação', () => assert.equal(result.status, 400));
  result = await request('/register', { ...payload, age: 0, emailVerificationToken: originalProof });
  check('Cadastro rejeita idade zero', () => assert.equal(result.status, 400));

  const resent = await request('/request-code', { email });
  result = await request('/register', { ...payload, emailVerificationToken: originalProof });
  check('Reenviar código invalida a confirmação anterior', () => assert.equal(result.status, 400));
  const reverified = await request('/verify-code', { email, code: resent.data.dev_code });
  const finalPayload = { ...payload, emailVerificationToken: reverified.data.verificationToken };
  const concurrent = await Promise.all([request('/register', finalPayload), request('/register', finalPayload)]);
  check('Cadastro concorrente cria uma única conta e não retorna erro interno', () => {
    assert.deepEqual(concurrent.map(item => item.status).sort(), [201, 409]);
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM users WHERE email = ?').get(email) as any).n, 1);
  });
  const created = concurrent.find(item => item.status === 201)!;
  const userId = created.data.user.id;
  let token = created.data.token;
  check('Confirmação de cadastro é consumida ao criar a conta', () => {
    assert.equal(db.prepare('SELECT email FROM email_verifications WHERE email = ?').get(email), undefined);
  });
  result = await request('/register', finalPayload);
  check('Cadastro duplicado retorna conflito', () => assert.equal(result.status, 409));
  result = await request('/login', { email, password: 'SenhaErrada@2026' });
  check('Login rejeita senha incorreta', () => assert.equal(result.status, 401));
  result = await request('/login', { email: email.toUpperCase(), password });
  check('Login por e-mail normaliza maiúsculas', () => { assert.equal(result.status, 200); assert.equal(result.data.user.id, userId); });
  result = await request('/login', { email: '@auditoria.regressao', password });
  check('Login aceita nome de usuário com arroba', () => assert.equal(result.data.user.id, userId));
  result = await request('/login', { email: 'auditoria.regressao', password });
  check('Login aceita nome de usuário sem arroba', () => assert.equal(result.data.user.id, userId));
  result = await request('/login', { email: 'inexistente@comunhao.example', password });
  check('Login de conta inexistente retorna erro de credenciais', () => assert.equal(result.status, 401));
  // Uma conta mais antiga com handle igual ao e-mail de outra conta não pode
  // capturar a busca por esse e-mail. O registro mais antigo do seed força o caso.
  const seeded = db.prepare("SELECT username_handle FROM users WHERE id = 'usr-maria-01'").get() as any;
  db.prepare("UPDATE users SET username_handle = ? WHERE id = 'usr-maria-01'").run('@' + email);
  result = await request('/login', { email, password });
  check('E-mail exato tem prioridade sobre handle de outra conta', () => assert.equal(result.data.user.id, userId));
  db.prepare("UPDATE users SET username_handle = ? WHERE id = 'usr-maria-01'").run(seeded.username_handle);

  for (const age of [0, '', 'invalida', true]) {
    result = await request('/update-profile', { age }, token);
    check(`Atualização rejeita idade ${JSON.stringify(age)}`, () => assert.equal(result.status, 400));
  }
  const reset = await request('/forgot-password', { email });
  result = await request('/update-profile', { lastName: 'Regressão' }, token);
  check('Atualizar perfil não expõe senha, códigos ou versão de sessão', () => {
    assert.equal(result.status, 200);
    for (const key of ['password_hash', 'verification_code', 'verification_code_expires_at', 'parent_consent_code', 'session_version']) {
      assert.equal(Object.hasOwn(result.data.user, key), false, key);
    }
    assert.equal(result.data.user.last_name, 'Regressão');
  });
  result = await request('/me', undefined, token + 'alterado');
  check('Sessão adulterada é rejeitada', () => assert.equal(result.status, 401));
  const expiredSession = jwt.sign({ id: userId, version: 0 }, jwtSecret, { algorithm: 'HS256', expiresIn: -1 });
  result = await request('/me', undefined, expiredSession);
  check('Sessão com validade vencida é rejeitada', () => assert.equal(result.status, 401));
  result = await request('/me', undefined, reverified.data.verificationToken);
  check('Prova de cadastro não funciona como sessão de usuário', () => assert.equal(result.status, 401));

  const newPassword = 'SenhaRenovada@2026';
  const resetPayload = { email, code: reset.data.dev_code, newPassword, confirmPassword: newPassword };
  result = await request('/reset-password', { ...resetPayload, code: '000000' });
  check('Recuperação rejeita código incorreto', () => assert.equal(result.status, 400));
  const resetRecord = db.prepare('SELECT verification_code_expires_at FROM users WHERE id = ?').get(userId) as any;
  db.prepare('UPDATE users SET verification_code_expires_at = ? WHERE id = ?').run('2000-01-01T00:00:00.000Z', userId);
  result = await request('/reset-password', resetPayload);
  check('Recuperação rejeita código expirado', () => assert.equal(result.status, 400));
  db.prepare('UPDATE users SET verification_code_expires_at = ? WHERE id = ?').run(resetRecord.verification_code_expires_at, userId);
  result = await request('/reset-password', { ...resetPayload, newPassword: 'fraca', confirmPassword: 'fraca' });
  check('Recuperação mantém exigência de senha forte', () => assert.equal(result.status, 400));
  result = await request('/reset-password', { ...resetPayload, confirmPassword: 'Diferente@2026' });
  check('Recuperação exige confirmação correspondente', () => assert.equal(result.status, 400));
  const resetParallel = await Promise.all([request('/reset-password', resetPayload), request('/reset-password', resetPayload)]);
  check('Código de recuperação é usado uma só vez mesmo com concorrência', () => {
    assert.deepEqual(resetParallel.map(item => item.status).sort(), [200, 400]);
  });
  result = await request('/reset-password', resetPayload);
  check('Código consumido não pode redefinir senha novamente', () => assert.equal(result.status, 400));
  result = await request('/me', undefined, token);
  check('Recuperação revoga a sessão anterior', () => assert.equal(result.status, 401));
  result = await request('/login', { email, password });
  check('Senha antiga deixa de autenticar', () => assert.equal(result.status, 401));
  result = await request('/login', { email, password: newPassword });
  check('Nova senha autentica normalmente', () => { assert.equal(result.status, 200); assert.equal(result.data.user.id, userId); });
  token = result.data.token;
  const completeProfile = {
    lastName: 'Regressão', age: 30, avatarUrl: 'https://example.com/avatar.png',
    addressStreet: 'Rua Teste', addressNeighborhood: 'Centro', addressCity: 'São Paulo', addressState: 'SP',
  };
  result = await request('/update-profile', completeProfile, token);
  check('Conclusão verdadeira do perfil concede bônus uma vez', () => {
    assert.equal(result.status, 200); assert.equal(result.data.bonus_awarded_now, true); assert.equal(result.data.user.total_points, 100);
  });
  result = await request('/update-profile', completeProfile, token);
  check('Repetir atualização não duplica bônus de perfil', () => {
    assert.equal(result.data.bonus_awarded_now, false); assert.equal(result.data.user.total_points, 100);
  });

  const childEmail = 'menor.auth@comunhao.example';
  const childCode = await request('/request-code', { email: childEmail });
  const childVerification = await request('/verify-code', { email: childEmail, code: childCode.data.dev_code });
  const parentPhone = '11912345678';
  const childName = 'Menor Auditoria';
  const consentCode = await request('/parental-consent/send', { parentPhone, childName });
  const consent = await request('/parental-consent/verify', { parentPhone, code: consentCode.data.dev_code });
  const childPayload = { name: childName, age: 15, email: childEmail, password, parentPhone, emailVerificationToken: childVerification.data.verificationToken };
  result = await request('/register', childPayload);
  check('Autorização verificada não é reutilizada sem a prova do responsável', () => assert.equal(result.status, 400));
  result = await request('/register', { ...childPayload, name: 'Outra Criança', parentConsentToken: consent.data.consentToken });
  check('Autorização parental fica vinculada ao nome da criança', () => assert.equal(result.status, 400));
  const otherPhone = '11933334444';
  const consentRecord = db.prepare('SELECT * FROM parental_consents WHERE parent_phone = ?').get(parentPhone) as any;
  db.prepare('INSERT INTO parental_consents (parent_phone,code,child_name,verified,expires_at,created_at) VALUES (?,?,?,?,?,?)')
    .run(otherPhone, consentRecord.code, consentRecord.child_name, 1, consentRecord.expires_at, consentRecord.created_at);
  result = await request('/register', { ...childPayload, parentPhone: otherPhone, parentConsentToken: consent.data.consentToken });
  check('Autorização de um responsável não confirma outro telefone', () => assert.equal(result.status, 400));
  result = await request('/register', { ...childPayload, parentConsentToken: consent.data.consentToken });
  check('Menor com ambas as provas válidas consegue se cadastrar', () => assert.equal(result.status, 201));
  const childToken = result.data.token;
  check('Autorização parental é consumida após cadastro', () => assert.equal(db.prepare('SELECT parent_phone FROM parental_consents WHERE parent_phone = ?').get(parentPhone), undefined));
  result = await request('/update-profile', { parentPhone: '11987654321' }, childToken);
  check('Trocar responsável exige nova autorização', () => assert.equal(result.status, 400));
  result = await request('/update-profile', { parentPhone: '' }, childToken);
  check('Menor não remove responsável preservando autorização antiga', () => assert.equal(result.status, 400));
  result = await request('/update-profile', { name: 'Novo Nome Menor' }, childToken);
  check('Mudar identidade do menor exige nova autorização', () => assert.equal(result.status, 400));
  result = await request('/update-profile', { lastName: 'Família' }, childToken);
  check('Alteração comum preserva autorização válida do menor', () => {
    assert.equal(result.status, 200); assert.equal(result.data.user.parent_consent_verified, 1);
  });
  const newParentPhone = '11987654321';
  const newConsentCode = await request('/parental-consent/send', { parentPhone: newParentPhone, childName });
  const newConsent = await request('/parental-consent/verify', { parentPhone: newParentPhone, code: newConsentCode.data.dev_code });
  result = await request('/update-profile', { parentPhone: newParentPhone, parentConsentToken: newConsent.data.consentToken }, childToken);
  check('Nova prova autoriza troca do responsável e atualiza resposta', () => {
    assert.equal(result.status, 200); assert.equal(result.data.user.parent_phone, newParentPhone); assert.equal(result.data.user.parent_consent_verified, 1);
  });

  const churchEmail = 'pastor.auth@comunhao.example';
  const churchPayload = { churchName: 'Igreja da Auditoria', pastorName: 'Pastor Auditoria', email: churchEmail, password };
  result = await request('/register-church', churchPayload);
  check('Cadastro de igreja exige confirmação do e-mail pastoral', () => assert.equal(result.status, 400));
  const churchCode = await request('/request-code', { email: churchEmail });
  const churchVerification = await request('/verify-code', { email: churchEmail, code: churchCode.data.dev_code });
  result = await request('/register-church', { ...churchPayload, emailVerificationToken: originalProof });
  check('Cadastro pastoral rejeita confirmação de outro e-mail', () => assert.equal(result.status, 400));
  result = await request('/register-church', { ...churchPayload, emailVerificationToken: churchVerification.data.verificationToken });
  check('Igreja e administrador são criados com e-mail confirmado', () => {
    assert.equal(result.status, 201); assert.equal(result.data.user.role, 'church_admin'); assert.equal(result.data.user.church_id, result.data.church.id);
    assert.equal(result.data.user.total_points, 0); assert.equal(result.data.user.profile_bonus_awarded, false); assert.ok(result.data.user.profile_completion_percent < 100);
  });
  check('Convite da igreja usa código sem endereço fictício', () => {
    assert.equal(result.data.church.invite_link, null);
    assert.ok(result.data.church.whatsapp_share_text.includes(result.data.church.slug_code));
    assert.equal(result.data.church.whatsapp_share_text.includes('app.igreja.com'), false);
  });
  const churchId = result.data.church.id;
  const pastor = db.prepare('SELECT * FROM users WHERE email = ?').get(churchEmail) as any;
  const quarter = db.prepare('SELECT * FROM quarters WHERE church_id = ?').get(churchId) as any;
  check('Temporada inicial da igreja inclui o dia atual', () => {
    assert.ok(quarter.start_date <= localDay()); assert.ok(quarter.end_date >= localDay()); assert.equal(quarter.is_active, 1);
  });
  check('Cadastro pastoral não inventa idade, endereço ou perfil completo', () => {
    assert.equal(pastor.age, null); assert.equal(pastor.address_street, null); assert.equal(pastor.email_verified, 1); assert.equal(pastor.profile_bonus_awarded, 0);
  });
  result = await request('/register-church', { ...churchPayload, emailVerificationToken: churchVerification.data.verificationToken });
  check('Cadastro pastoral duplicado retorna conflito', () => assert.equal(result.status, 409));
  check('Regressões respeitam o limite real de tentativas de autenticação', () => assert.ok(mutations <= 60, `${mutations} requisições`));
  while (mutations < 60) await request('/login', { email: 'nao-existe@comunhao.example', password });
  result = await request('/login', { email, password: newPassword });
  check('Tentativa 61 é bloqueada com prazo para repetir', () => {
    assert.equal(result.status, 429); assert.ok(Number(result.headers.get('Retry-After')) > 0);
  });
  console.log(`\n${checks} regressões de autenticação passaram (${mutations} requisições mutáveis).`);
}
