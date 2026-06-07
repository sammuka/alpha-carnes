import { Global, Module } from '@nestjs/common';
import { AuditoriaService } from './auditoria.service';

/**
 * Disponibiliza o AuditoriaService globalmente, para que qualquer módulo de
 * cadastro possa auditar mutações dentro de suas transações sem reimportá-lo.
 */
@Global()
@Module({
  providers: [AuditoriaService],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}
