import inquirerP from 'inquirer';
import type { Answers, QuestionCollection, ui } from 'inquirer';

function prompt<T extends Answers = Answers>(
  questions: QuestionCollection<T>,
  initialAnswers?: Partial<T>
): Promise<T> & { ui: ui.Prompt<T> } {
  return inquirerP.prompt(questions, initialAnswers);
}

const Separator = inquirerP.Separator;

export const inquirer = {
  prompt,
  Separator
};
