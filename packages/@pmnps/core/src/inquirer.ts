import inquirer, { Answers, QuestionCollection, ui } from 'inquirer';

function prompt<T extends Answers = Answers>(
  questions: QuestionCollection<T>,
  initialAnswers?: Partial<T>
): Promise<T> & { ui: ui.Prompt<T> } {
  return inquirer.prompt(questions, initialAnswers);
}

export default {
  prompt
};
