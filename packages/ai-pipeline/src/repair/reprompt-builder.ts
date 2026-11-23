/**
 * Generates targeted reprompts when model output is structurally broken or fails contract checks.
 * Informs the model of the exact failure so it can repair the output on retry.
 */

export function buildRepromptMessage(errorDetails: {
  validationErrors: string[];
  previousOutputSnippet?: string;
  schemaType: 'StructuredObjectDescription' | 'SceneSpec';
}): string {
  const lines: string[] = [
    `Your previous response failed strict validation for the ${errorDetails.schemaType} schema.`,
    'Please correct the following specific errors and return ONLY the corrected, valid JSON:',
  ];

  for (const err of errorDetails.validationErrors) {
    lines.push(`- ${err}`);
  }

  if (errorDetails.previousOutputSnippet) {
    lines.push('\nExcerpt of previous invalid output:');
    lines.push(`\`\`\`json\n${errorDetails.previousOutputSnippet.substring(0, 300)}\n\`\`\``);
  }

  lines.push('\nRemember: Pure JSON only, no markdown commentary outside the JSON object.');
  return lines.join('\n');
}
