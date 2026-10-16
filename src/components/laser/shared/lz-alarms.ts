/** GRBL 1.1 alarm codes, short Portuguese explanation + what to do. */
export const GRBL_ALARMS: Record<number, { title: string; help: string }> = {
  1: {
    title: 'Fim de curso acionado',
    help: 'A cabeça tocou num fim de curso. A posição deixou de ser fiável: faça Home.',
  },
  2: { title: 'Fora da área de trabalho', help: 'O movimento pedido ultrapassava os limites da máquina. Faça Home.' },
  3: {
    title: 'Reset durante movimento',
    help: 'A placa foi reiniciada a meio de um movimento; a posição pode ter-se perdido. Faça Home.',
  },
  4: { title: 'Sonda não estava livre', help: 'A sonda já estava ativa no início da sondagem.' },
  5: { title: 'Sonda não tocou', help: 'A sondagem terminou sem contacto.' },
  6: { title: 'Home interrompido', help: 'O ciclo de Home foi interrompido (reset, porta ou tampa).' },
  7: { title: 'Home falhou: porta aberta', help: 'A porta abriu durante o Home. Feche a tampa e repita.' },
  8: {
    title: 'Home falhou: fim de curso preso',
    help: 'O fim de curso não libertou. Verifique o interruptor e a cablagem.',
  },
  9: {
    title: 'Home falhou: fim de curso não encontrado',
    help: 'A cabeça não encontrou o fim de curso. Verifique o interruptor.',
  },
  10: { title: 'Home falhou: dois fins de curso', help: 'Fim de curso duplo acionado ao mesmo tempo.' },
};

export const ALARM_LOCKED = {
  title: 'Máquina bloqueada',
  help: 'A placa arrancou bloqueada (Home obrigatório) ou saiu de um alarme. Faça Home para desbloquear.',
};
