import { Pipe, PipeTransform } from '@angular/core';

import { tr } from '../../../services/laser/laser-i18n';

/** Translates an OctoDash-Laser string: {{ 'Texto' | lzt }} or {{ 'velocidade {v} mm/s' | lzt: { v: 10 } }} */
@Pipe({
  name: 'lzt',
  standalone: false,
})
export class LzTranslatePipe implements PipeTransform {
  public transform(text: string, params?: Record<string, string | number>): string {
    return tr(text, params);
  }
}
