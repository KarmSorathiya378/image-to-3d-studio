import { MalformedModelOutputError } from '../errors/pipeline-errors.ts';
import type { JsonRepairResult } from './types.ts';

/**
 * Extracts, sanitizes, and repairs JSON from LLM/VLM text responses.
 * Handles:
 * - Markdown code fences
 * - Leading/trailing conversational text
 * - Trailing commas in arrays and objects
 * - Single-quoted strings and unquoted object keys
 * - Inline and block comments
 * - Truncated JSON recovery (unclosed brackets/braces)
 */
export function repairModelJsonResponse<T = unknown>(rawText: string): JsonRepairResult<T> {
  if (!rawText || typeof rawText !== 'string' || rawText.trim() === '') {
    throw new MalformedModelOutputError('Model response is empty or non-string');
  }

  const actions: string[] = [];
  let candidate = rawText.trim();

  // 1. Try parsing directly first
  try {
    const parsed = JSON.parse(candidate) as T;
    return { parsed, repaired: false, repairActions: [] };
  } catch {
    // Continue with repair heuristics
  }

  // 2. Extract content from markdown code fences
  const fenceMatch = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    candidate = fenceMatch[1].trim();
    actions.push('Extracted JSON from markdown code fence');
  } else {
    // 3. Find first '{' or '[' and last '}' or ']'
    const firstBrace = candidate.indexOf('{');
    const firstBracket = candidate.indexOf('[');
    let startIdx = -1;

    if (firstBrace !== -1 && firstBracket !== -1) {
      startIdx = Math.min(firstBrace, firstBracket);
    } else if (firstBrace !== -1) {
      startIdx = firstBrace;
    } else if (firstBracket !== -1) {
      startIdx = firstBracket;
    }

    if (startIdx !== -1) {
      const lastBrace = candidate.lastIndexOf('}');
      const lastBracket = candidate.lastIndexOf(']');
      const endIdx = Math.max(lastBrace, lastBracket);

      if (endIdx > startIdx) {
        candidate = candidate.substring(startIdx, endIdx + 1);
        actions.push('Stripped conversational text before/after JSON boundary');
      } else {
        // String has start brace but no closing brace (truncated response)
        candidate = candidate.substring(startIdx);
        actions.push('Detected truncated JSON start');
      }
    }
  }

  // 4. Try parsing after stripping outer fluff
  try {
    const parsed = JSON.parse(candidate) as T;
    return { parsed, repaired: true, repairActions: actions };
  } catch {
    // Continue deep repair
  }

  // 5. Strip single-line and multi-line comments
  const withoutComments = candidate
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\r\n]*/g, '$1');
  if (withoutComments !== candidate) {
    candidate = withoutComments;
    actions.push('Removed inline/block comments');
  }

  // 6. Fix trailing commas before } and ]
  const withoutTrailingCommas = candidate.replace(/,\s*([\}\]])/g, '$1');
  if (withoutTrailingCommas !== candidate) {
    candidate = withoutTrailingCommas;
    actions.push('Removed trailing commas');
  }

  // 7. Fix single quotes to double quotes (for JSON keys and string values)
  if (candidate.includes("'")) {
    // Replace single quotes around keys/values when not preceded by an escape
    const doubleQuoted = candidate.replace(/(?<=[{\[,:\s])'([^'\\]*(?:\\.[^'\\]*)*)'(?=[\s,:\]\}])/g, '"$1"');
    if (doubleQuoted !== candidate) {
      candidate = doubleQuoted;
      actions.push('Replaced single quotes with standard double quotes');
    }
  }

  // 8. Fix unquoted keys e.g. { id: "seat" } -> { "id": "seat" }
  const withQuotedKeys = candidate.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3');
  if (withQuotedKeys !== candidate) {
    candidate = withQuotedKeys;
    actions.push('Enclosed unquoted object keys in double quotes');
  }

  // 9. Try parsing again
  try {
    const parsed = JSON.parse(candidate) as T;
    return { parsed, repaired: true, repairActions: actions };
  } catch {
    // Try truncated JSON recovery
  }

  // 10. Truncated recovery: balance unclosed brackets and braces
  const recovered = balanceTruncatedJson(candidate);
  if (recovered !== candidate) {
    try {
      const parsed = JSON.parse(recovered) as T;
      actions.push('Recovered truncated JSON by closing dangling braces/brackets');
      return { parsed, repaired: true, repairActions: actions };
    } catch {
      // Recovery failed
    }
  }

  // If all repair attempts fail, reject deterministically
  throw new MalformedModelOutputError(
    `Failed to repair malformed model JSON response: "${candidate.substring(0, 120)}..."`,
    { rawPreview: candidate.substring(0, 200), repairAttempts: actions }
  );
}

function balanceTruncatedJson(str: string): string {
  let inString = false;
  let escape = false;
  const stack: string[] = [];

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') stack.push('}');
    else if (char === '[') stack.push(']');
    else if (char === '}' || char === ']') {
      if (stack.length > 0 && stack[stack.length - 1] === char) {
        stack.pop();
      }
    }
  }

  // If truncated in middle of string, close the quote
  let result = inString ? `${str}"` : str;

  // Remove dangling trailing comma or colon if present at truncated tail
  result = result.replace(/[,:\s]+$/, '');

  // Close dangling brackets in reverse order
  while (stack.length > 0) {
    result += stack.pop();
  }

  return result;
}
