import cron from 'node-cron';
import { runDailyDigest, runDeadlineScan } from './notifications/notifications.service.js';

async function run(name: string, job: () => Promise<number>): Promise<void> {
  try {
    const sent = await job();
    if (sent > 0) console.log(`${name}: ${sent} aviso(s) enviados`);
  } catch (error) {
    // Un fallo aquí no debe tumbar el proceso: se reintenta en la próxima vuelta.
    console.error(`${name} falló:`, error);
  }
}

export function startScheduler(): void {
  // Cada hora en punto: solo actúa sobre quienes están en su hora local elegida.
  cron.schedule('0 * * * *', () => void run('resumen diario', runDailyDigest));

  // Cuatro veces al día basta para un margen de dos días.
  cron.schedule('30 */6 * * *', () => void run('revisión de vencimientos', runDeadlineScan));

  console.log('Avisos programados: resumen cada hora, vencimientos cada 6 h');
}
