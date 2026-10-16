/**
 * OctoDash-Laser runtime translations (laser screens only).
 * Source strings are Portuguese; this file holds the English versions keyed by the Portuguese
 * text. The language comes from config.laser.language and is applied when the config loads
 * (saving settings reloads the app). Placeholders: {name}.
 */
export type LaserLanguage = 'pt' | 'en';

let current: LaserLanguage = 'pt';

export function setLaserLanguage(language: string | undefined): void {
  current = language === 'en' ? 'en' : 'pt';
  if (typeof document !== 'undefined') {
    document.documentElement.lang = current === 'en' ? 'en' : 'pt-PT';
  }
}

export function getLaserLanguage(): LaserLanguage {
  return current;
}

export function tr(text: string, params?: Record<string, string | number>): string {
  let out = current === 'en' ? (EN[text] ?? text) : text;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      out = out.split(`{${key}}`).join(String(value));
    }
  }
  return out;
}

export const EN: Record<string, string> = {
  // status
  'Sem ligação': 'Offline',
  'A ligar': 'Connecting',
  Pronto: 'Ready',
  'A trabalhar': 'Running',
  'Em pausa': 'Paused',
  'Em movimento': 'Moving',
  Alarme: 'Alarm',
  'Porta aberta': 'Door open',
  'Em repouso': 'Sleeping',
  Verificação: 'Check mode',
  'A pausar': 'Pausing',
  Ar: 'Air',
  Voltar: 'Back',

  // home
  Câmara: 'Camera',
  'máq.': 'mach.',
  Desbloquear: 'Unlock',
  'Feche a tampa. O laser não dispara com a porta aberta.':
    'Close the lid. The laser will not fire while the door is open.',
  'Sem ligação à placa': 'No connection to the board',
  'O OctoPrint não está ligado à placa GRBL.': 'OctoPrint is not connected to the GRBL board.',
  Ligar: 'Connect',
  'Escolher trabalho': 'Choose job',
  Mover: 'Jog',
  'Ir à origem': 'Go to origin',
  Mais: 'More',
  'Alarme — faça Home para desbloquear': 'Alarm — home the machine to unlock',
  Trabalho: 'Job',
  Mapa: 'Map',
  'selecionado: {name}': 'selected: {name}',
  'último: {name}': 'last: {name}',
  'ficheiros enviados pelo RayForge': 'files sent from RayForge',

  // jog
  'ir à origem': 'go to origin',
  'Contínuo — move enquanto premir': 'Continuous — moves while held',
  'Passo (mm)': 'Step (mm)',
  'velocidade {v} mm/s': 'speed {v} mm/s',
  'Origem aqui': 'Set origin here',
  'Disparo de teste': 'Test fire',
  'manter premido · {v}': 'press and hold · {v}',

  // jobs
  Trabalhos: 'Jobs',
  'recentes primeiro': 'newest first',
  'A ler ficheiros': 'Reading files',
  'Tentar de novo': 'Try again',
  'Sem ficheiros G-code no OctoPrint.': 'No G-code files in OctoPrint.',
  'Envie um trabalho a partir do RayForge.': 'Send a job from RayForge.',
  'A analisar o G-code': 'Analysing G-code',
  'Tamanho (mm)': 'Size (mm)',
  Tempo: 'Time',
  Potência: 'Power',
  'Sai fora da mesa com a origem atual': 'Runs off the bed with the current origin',
  Enquadrar: 'Frame',
  'Preparar →': 'Prepare →',
  'Erro ao ler os ficheiros': 'Error reading files',

  // prepare
  'Antes de começar': 'Before you start',
  'Máquina pronta': 'Machine ready',
  'Máquina: {state}': 'Machine: {state}',
  'GRBL em Idle': 'GRBL is idle',
  'aguarde que pare': 'wait for it to stop',
  'o firmware pode recusar o trabalho': 'the firmware may refuse the job',
  'Sai fora da área de trabalho': 'Outside the work area',
  'Dentro da área de trabalho': 'Inside the work area',
  'Área por verificar': 'Work area not checked',
  'posição desconhecida — faça Home': 'position unknown — home the machine',
  Enquadrado: 'Framed',
  'Enquadramento por fazer': 'Not framed yet',
  'contorno percorrido com o laser desligado': 'outline traced with the laser off',
  opcional: 'optional',
  confirmado: 'confirmed',
  'tocar para confirmar': 'tap to confirm',
  'A iniciar…': 'Starting…',
  'Iniciar mesmo assim · {n} aviso': 'Start anyway · {n} warning',
  'Iniciar mesmo assim · {n} avisos': 'Start anyway · {n} warnings',
  'Deslizar para iniciar': 'Slide to start',
  '{n} passagens': '{n} passes',
  'Tampa fechada': 'Lid closed',
  'Água a circular': 'Water flowing',
  'Ar comprimido ligado': 'Air assist on',

  // running
  Falta: 'Left',
  Decorrido: 'Elapsed',
  'Termina ≈ {t}': 'Ends ≈ {t}',
  '{a} de {b}': '{a} of {b}',
  'Porta aberta — o trabalho está suspenso': 'Door open — job suspended',
  'Alarme GRBL — trabalho interrompido': 'GRBL alarm — job interrupted',
  'A pausar…': 'Pausing…',
  'termina o movimento atual': 'finishing the current move',
  Retomar: 'Resume',
  Pausa: 'Pause',
  Parar: 'Stop',
  'manter 1 s': 'hold 1 s',
  Início: 'Main screen',
  Concluído: 'Done',
  Parado: 'Stopped',
  'Sem trabalho em curso': 'No job running',

  // more
  Definições: 'Settings',
  'Recarregar ecrã': 'Reload screen',
  Confirmar: 'Confirm',
  'Reiniciar OctoPrint': 'Restart OctoPrint',
  'Desligar Pi': 'Shut down Pi',
  'Comando especial não suportado': 'Unsupported special command',

  // camera
  'Câmara não configurada': 'Camera not configured',
  'Câmara indisponível': 'Camera unavailable',
  'A ligar à câmara': 'Connecting to camera',

  // services
  'Não foi possível enviar o comando': 'Could not send the command',
  'Não foi possível ler o ficheiro': 'Could not read the file',
  'Não foi possível iniciar o trabalho': 'Could not start the job',
  'Comando de trabalho falhou': 'Job command failed',

  // dates
  'hoje {t}': 'today {t}',
  ontem: 'yesterday',
  fev: 'Feb',
  abr: 'Apr',
  mai: 'May',
  ago: 'Aug',
  set: 'Sep',
  out: 'Oct',
  dez: 'Dec',
  jan: 'Jan',
  mar: 'Mar',
  jun: 'Jun',
  jul: 'Jul',
  nov: 'Nov',

  // GRBL alarms
  'Fim de curso acionado': 'Limit switch triggered',
  'A cabeça tocou num fim de curso. A posição deixou de ser fiável: faça Home.':
    'The head hit a limit switch. The position is no longer reliable: home the machine.',
  'Fora da área de trabalho': 'Outside the work area',
  'O movimento pedido ultrapassava os limites da máquina. Faça Home.':
    'The requested move exceeded the machine limits. Home the machine.',
  'Reset durante movimento': 'Reset while moving',
  'A placa foi reiniciada a meio de um movimento; a posição pode ter-se perdido. Faça Home.':
    'The board was reset during a move; the position may be lost. Home the machine.',
  'Sonda não estava livre': 'Probe was not clear',
  'A sonda já estava ativa no início da sondagem.': 'The probe was already triggered when probing started.',
  'Sonda não tocou': 'Probe did not touch',
  'A sondagem terminou sem contacto.': 'Probing ended without contact.',
  'Home interrompido': 'Homing interrupted',
  'O ciclo de Home foi interrompido (reset, porta ou tampa).': 'The homing cycle was interrupted (reset, door or lid).',
  'Home falhou: porta aberta': 'Homing failed: door open',
  'A porta abriu durante o Home. Feche a tampa e repita.':
    'The door opened during homing. Close the lid and try again.',
  'Home falhou: fim de curso preso': 'Homing failed: switch stuck',
  'O fim de curso não libertou. Verifique o interruptor e a cablagem.':
    'The limit switch did not release. Check the switch and wiring.',
  'Home falhou: fim de curso não encontrado': 'Homing failed: switch not found',
  'A cabeça não encontrou o fim de curso. Verifique o interruptor.':
    'The head did not find the limit switch. Check the switch.',
  'Home falhou: dois fins de curso': 'Homing failed: two switches',
  'Fim de curso duplo acionado ao mesmo tempo.': 'Two limit switches triggered at the same time.',
  'Máquina bloqueada': 'Machine locked',
  'A placa arrancou bloqueada (Home obrigatório) ou saiu de um alarme. Faça Home para desbloquear.':
    'The board started locked (homing required) or left an alarm. Home the machine to unlock.',
};
