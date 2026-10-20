'use strict';

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

// Strip control characters (keeping newlines and tabs) and trim.
function clean(value, { multiline = false } = {}) {
  let s = typeof value === 'string' ? value : '';
  s = s.normalize('NFC').replace(multiline ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, '');
  return s.trim();
}

/**
 * Validate a request body against a simple schema.
 * schema: { field: { label, required, max, min, email, url, multiline, oneOf } }
 * Returns { values, errors } where errors maps field -> message.
 */
function validate(body, schema) {
  const values = {};
  const errors = {};
  for (const [field, rule] of Object.entries(schema)) {
    const v = clean(body ? body[field] : '', { multiline: rule.multiline });
    values[field] = v;
    const label = rule.label || field;
    if (!v) {
      if (rule.required) errors[field] = `${label} is required.`;
      continue;
    }
    if (rule.min && v.length < rule.min) errors[field] = `${label} must be at least ${rule.min} characters.`;
    else if (rule.max && v.length > rule.max) errors[field] = `${label} must be at most ${rule.max} characters.`;
    else if (rule.email && !EMAIL_RE.test(v)) errors[field] = 'Please enter a valid email address.';
    else if (rule.url && !isSafeUrl(v)) errors[field] = 'Please enter a full http(s) link.';
    else if (rule.oneOf && !rule.oneOf.includes(v)) errors[field] = `Please choose a valid ${label.toLowerCase()}.`;
  }
  return { values, errors, ok: Object.keys(errors).length === 0 };
}

function isSafeUrl(value) {
  try {
    const u = new URL(value);
    return (u.protocol === 'https:' || u.protocol === 'http:') && !u.username && !u.password;
  } catch {
    return false;
  }
}

function toId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

module.exports = { validate, clean, isSafeUrl, toId };
