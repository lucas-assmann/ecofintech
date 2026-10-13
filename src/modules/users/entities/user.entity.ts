/** Usuário como devolvido pela API (sem a senha). */
export class User {
  /** @example "3f1c2a9e-8b7d-4c6e-9a1b-2d3e4f5a6b7c" */
  id: string;

  /** @example "Maria Silva" */
  name: string;

  /** @example "maria@email.com" */
  email: string;

  /** @example "1995-08-20" */
  dateOfBirth: string;

  createdAt: Date;

  updatedAt: Date;
}
