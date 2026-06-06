import { ConfigFactory } from '@nestjs/config';
import { envSchema } from './env.schema';

export const appConfig: ConfigFactory = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Configuração de ambiente inválida:');
    console.error(JSON.stringify(result.error.issues, null, 2));
    process.exit(1);
  }
  return result.data;
};
