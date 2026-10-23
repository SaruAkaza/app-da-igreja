import net from 'node:net';
import type { AddressInfo } from 'node:net';

// Caixa SMTP somente de testes, limitada ao loopback. Não encaminha mensagens.
export async function startTestMailbox() {
  const messages: { recipients: string[]; data: string }[] = [];
  const sockets = new Set<net.Socket>();
  let mode: 'accept' | 'reject' | 'silent' = 'accept';
  const server = net.createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    socket.setEncoding('utf8');
    let buffer = '', data: string[] | null = null, recipients: string[] = [];
    if (mode !== 'silent') socket.write('220 localhost SMTP test ready\r\n');
    socket.on('data', chunk => {
      buffer += chunk;
      let end: number;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end).replace(/\r$/, '');
        buffer = buffer.slice(end + 1);
        if (data) {
          if (line === '.') {
            messages.push({ recipients: [...recipients], data: data.join('\r\n') });
            data = null;
            socket.write('250 Message accepted\r\n');
          } else data.push(line.startsWith('..') ? line.slice(1) : line);
        } else if (/^(EHLO|HELO) /i.test(line)) socket.write('250-localhost\r\n250 PIPELINING\r\n');
        else if (/^MAIL FROM:/i.test(line)) { recipients = []; socket.write('250 Sender accepted\r\n'); }
        else if (/^RCPT TO:/i.test(line)) {
          if (mode === 'reject') socket.write('550 Recipient refused by test fixture\r\n');
          else { recipients.push((line.match(/<([^>]+)>/)?.[1] || '').toLowerCase()); socket.write('250 Recipient accepted\r\n'); }
        } else if (line === 'DATA') { data = []; socket.write('354 End with a dot\r\n'); }
        else if (line === 'QUIT') socket.end('221 Bye\r\n');
        else if (line === 'RSET' || line === 'NOOP') socket.write('250 OK\r\n');
        else socket.write('502 Unsupported test command\r\n');
      }
    });
  });
  server.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  return {
    url: `smtp://127.0.0.1:${(server.address() as AddressInfo).port}`,
    messages,
    setMode(value: typeof mode) { mode = value; },
    codeFor(email: string) {
      const message = [...messages].reverse().find(item => item.recipients.includes(email.trim().toLowerCase()));
      const body = message?.data.split(/\r?\n\r?\n/).slice(1).join('\n').replace(/=\r?\n/g, '');
      const code = body?.match(/\b\d{6}\b/)?.[0];
      if (!code) throw new Error('Código não chegou à caixa SMTP de teste.');
      return code;
    },
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
  };
}
