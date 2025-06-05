
'use server';

/**
 * @fileOverview Provides personalized insights into spending habits based on past income and expense entries.
 *
 * - getSpendingInsights - A function that generates spending insights.
 * - SpendingInsightsInput - The input type for the getSpendingInsights function.
 * - SpendingInsightsOutput - The return type for the getSpendingInsights function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SpendingInsightsInputSchema = z.object({
  incomeSources: z
    .array(z.object({
      name: z.string().describe('The name of the income source (e.g., Salary, Freelance).'),
      amount: z.number().describe('The amount from this income source.'),
    }))
    .describe('An array of different income sources for the period.'),
  totalIncome: z.number().describe('The total combined income from all sources.'),
  expenses: z
    .array(z.object({
      category: z.string().describe('The category of the expense.'),
      amount: z.number().describe('The amount spent on the expense.'),
      paidBy: z.string().optional().describe('Name of the income source that paid this expense, if specified.')
    }))
    .describe('An array of expenses with their categories, amounts, and optionally which income source paid them.'),
  language: z.string().describe('The desired language for the insights, e.g., "English" or "Portuguese".'),
});
export type SpendingInsightsInput = z.infer<typeof SpendingInsightsInputSchema>;

const SpendingInsightsOutputSchema = z.object({
  insights: z.string().describe('Personalized insights into spending habits.'),
});
export type SpendingInsightsOutput = z.infer<typeof SpendingInsightsOutputSchema>;

export async function getSpendingInsights(input: SpendingInsightsInput): Promise<SpendingInsightsOutput> {
  return spendingInsightsFlow(input);
}

const spendingInsightsPrompt = ai.definePrompt({
  name: 'spendingInsightsPrompt',
  input: {schema: SpendingInsightsInputSchema},
  output: {schema: SpendingInsightsOutputSchema},
  prompt: `You are a financial advisor providing personalized insights into spending habits.

  Generate the insights in the following language: {{{language}}}.

  Based on the following income sources, total income, and expenses, provide insights into the user's spending habits, and suggest areas where they can save money and improve their financial health. Consider how different income sources contribute to expenses if that data is provided.

  Income Sources:
  {{#each incomeSources}}
  - Name: {{{name}}}, Amount: {{{amount}}}
  {{/each}}

  Total Income: {{{totalIncome}}}
  
  Expenses:
  {{#each expenses}}
  - Category: {{{category}}}, Amount: {{{amount}}}{{#if paidBy}}, Paid by: {{{paidBy}}}{{/if}}
  {{/each}}
  `,
});

const spendingInsightsFlow = ai.defineFlow(
  {
    name: 'spendingInsightsFlow',
    inputSchema: SpendingInsightsInputSchema,
    outputSchema: SpendingInsightsOutputSchema,
  },
  async input => {
    const {output} = await spendingInsightsPrompt(input);
    return output!;
  }
);
