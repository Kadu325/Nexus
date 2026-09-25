import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Converte erros em respostas JSON padronizadas, sem vazar detalhes internos. */
@Catch()
export class ErrorsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Erro');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const req = host.switchToHttp().getRequest();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: Record<string, unknown> = { message: 'Erro interno. Tente novamente ou contate o administrador.' };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      body = typeof r === 'string' ? { message: r } : { ...(r as object) };
      if (Array.isArray(body.message)) body.message = (body.message as string[]).join(' ');
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        body = { message: 'Já existe um registro com esses dados únicos.', code: 'DUPLICADO' };
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        body = { message: 'Registro não encontrado.' };
      } else if (exception.code === 'P2003') {
        status = HttpStatus.CONFLICT;
        body = { message: 'O registro está vinculado a outros dados e não pode ser alterado desta forma.' };
      } else {
        this.logger.error(`${req.method} ${req.url} Prisma ${exception.code}`);
      }
    } else {
      this.logger.error(`${req.method} ${req.url}: ${(exception as Error)?.message}`, (exception as Error)?.stack);
    }
    delete body.statusCode;
    delete body.error;
    res.status(status).json({ statusCode: status, ...body });
  }
}
