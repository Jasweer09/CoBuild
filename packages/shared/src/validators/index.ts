import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const createChatbotSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  systemPrompt: z.string().max(10000).optional(),
  temperature: z.number().min(0).max(1).optional(),
});

export const createQnaPairSchema = z.object({
  question: z.string().min(1, 'Question is required').max(2000),
  answer: z.string().min(1, 'Answer is required').max(5000),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type CreateChatbotInput = z.infer<typeof createChatbotSchema>;
export type CreateQnaPairInput = z.infer<typeof createQnaPairSchema>;
