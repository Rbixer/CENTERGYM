export type PublicTrainer = { id: string; label: string };
export type PublicQuestion = {
  id: string;
  text: string;
  options: { id: string; text: string }[];
};
