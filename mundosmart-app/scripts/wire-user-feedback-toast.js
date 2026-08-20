/**
 * Após `this.erro = <literal de validação>`, adiciona `avisarErroUsuario(this.erro);`
 * e o import do helper. Ignora limpeza, HTTP (err./Erro ao...) e linhas já wireadas.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src', 'app');
const SKIP_MSG = /^(Erro ao |Falha ao |Falha na |Não foi possível |Não foi encontrado|Timeout|HTTP |Ocorreu um erro|Erro inesperado)/i;

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      walk(p, acc);
    } else if (name.endsWith('.ts') && !name.endsWith('.spec.ts')) {
      acc.push(p);
    }
  }
  return acc;
}

function relImport(fromFile) {
  const fromDir = path.dirname(fromFile);
  const target = path.join(ROOT, 'services', 'user-feedback.service');
  let rel = path.relative(fromDir, target).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return `import { avisarErroUsuario } from '${rel}';`;
}

function isClearExpr(expr) {
  const t = expr.trim();
  return t === "''" || t === '""' || t === '``' || t === 'null' || t === 'undefined';
}

function shouldSkipAssignment(expr) {
  const t = expr.trim();
  if (isClearExpr(t)) return true;
  if (/\berr\b/.test(t) || /\berror\s*\?\.|\berror\./.test(t)) return true;
  if (/extrairMensagem|mensagemErroHttp/i.test(t)) return true;
  if (t === 'mensagem' || t === 'msg' || t === 'message') return true;

  const lit = t.match(/^(['"`])([\s\S]*)\1$/);
  if (lit) {
    const body = lit[2];
    if (!body.trim()) return true;
    if (SKIP_MSG.test(body)) return true;
    return false;
  }
  if (t.startsWith('`')) {
    const approx = t.replace(/^`/, '').replace(/\$\{[\s\S]*?\}/g, 'X');
    if (SKIP_MSG.test(approx)) return true;
    return false;
  }
  return true;
}

/** True se estamos dentro do corpo de setErroUsuario / similar. */
function insideFeedbackHelper(lines, index) {
  for (let j = index - 1; j >= 0 && j >= index - 40; j--) {
    const L = lines[j];
    if (/^\s*(private|public)?\s*setErroUsuario\s*\(/.test(L)) return true;
    if (/^\s*(private|public|protected)?\s+\w+/.test(L) && /\{\s*$/.test(L) && !/setErroUsuario/.test(L)) {
      return false;
    }
    if (/^export class /.test(L)) return false;
  }
  return false;
}

function processFile(file) {
  if (file.includes(`${path.sep}services${path.sep}`)) return false;
  if (file.includes(`${path.sep}interceptors${path.sep}`)) return false;

  const src = fs.readFileSync(file, 'utf8');
  if (!/this\.erro\s*=/.test(src)) return false;

  const lines = src.split(/\r?\n/);
  const out = [];
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    out.push(line);

    const next = (lines[i + 1] ?? '').trim();
    if (next.startsWith('avisarErroUsuario(')) continue;
    if (insideFeedbackHelper(lines, i)) continue;

    const m = line.match(/^(\s*)this\.erro\s*=\s*(.+);\s*$/);
    if (!m) continue;

    const indent = m[1];
    const expr = m[2];
    if (shouldSkipAssignment(expr)) continue;

    out.push(`${indent}avisarErroUsuario(this.erro);`);
    changed = true;
  }

  if (!changed) return false;

  let result = out.join('\n');
  if (!/from ['"].*user-feedback\.service['"]/.test(result)) {
    const importStmt = relImport(file);
    const importBlock = result.match(/^(?:import[\s\S]*?;\r?\n)+/);
    if (importBlock) {
      const end = importBlock[0].length;
      result = result.slice(0, end) + importStmt + '\n' + result.slice(end);
    } else {
      result = importStmt + '\n' + result;
    }
  }

  fs.writeFileSync(file, result, 'utf8');
  return true;
}

const files = walk(ROOT);
let n = 0;
for (const f of files) {
  if (processFile(f)) {
    n++;
    console.log('patched', path.relative(ROOT, f));
  }
}
console.log(`Done. ${n} files updated.`);
