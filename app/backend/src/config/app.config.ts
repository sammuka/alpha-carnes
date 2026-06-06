import { ConfigFactory } from '@nestjs/config';
import { envSchema } from './env.schema';

export const appConfig: ConfigFactory = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Configuração de ambiente inválida:');
    console.error(result.error.format());
    process.exit(1);
  }
  return result.data;
};
