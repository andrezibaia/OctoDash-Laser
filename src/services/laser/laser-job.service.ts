import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { LaserJobFile, ParsedGcode } from '../../model';
import { OctoprintFile, OctoprintFolder } from '../../model/octoprint';
import { ConfigService } from '../config.service';
import { NotificationService } from '../notification.service';
import { parseGcode } from './gcode-parser';
import { tr } from './laser-i18n';

type FileOrFolder = OctoprintFile & OctoprintFolder;

export interface SelectedJob {
  file: LaserJobFile;
  parsed: ParsedGcode | null;
  loading: boolean;
  error?: string;
  framed: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class LaserJobService {
  private cache = new Map<string, Promise<ParsedGcode>>();
  private selected = new BehaviorSubject<SelectedJob>(null);
  private lastJob: LaserJobFile = null;

  public constructor(
    private http: HttpClient,
    private configService: ConfigService,
    private notificationService: NotificationService,
  ) {}

  //==== Files ====//

  public listJobs(): Observable<LaserJobFile[]> {
    return this.http
      .get<{
        files: FileOrFolder[];
      }>(this.configService.getApiURL('files/local?recursive=true'), this.configService.getHTTPHeaders())
      .pipe(
        map(response => {
          const out: LaserJobFile[] = [];
          const walk = (items: FileOrFolder[]) => {
            for (const item of items ?? []) {
              if (item.type === 'folder') {
                walk(item.children);
              } else if (item.typePath?.includes('gcode')) {
                out.push(this.toJobFile(item));
              }
            }
          };
          walk(response.files);
          return out.sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
        }),
      );
  }

  private toJobFile(file: OctoprintFile): LaserJobFile {
    return {
      path: `/${file.origin}/${file.path}`,
      name: file.name,
      display: (file.display ?? file.name).replace(/\.(gcode|gco|g|nc|ngc)$/i, ''),
      size: file.size,
      date: file.date,
      downloadUrl: this.configService.getApiURL(
        `downloads/files/${file.origin}/${file.path.split('/').map(encodeURIComponent).join('/')}`,
        false,
      ),
    };
  }

  //==== Parsing ====//

  public getParsed(file: LaserJobFile): Promise<ParsedGcode> {
    const key = `${file.path}@${file.date}`;
    if (!this.cache.has(key)) {
      const promise = firstValueFrom(
        this.http.get(file.downloadUrl, {
          headers: this.configService.getHTTPHeaders().headers,
          responseType: 'text',
        }),
      ).then(text => parseGcode(text, { rapidFeed: this.configService.getLaser().rapidFeed }));
      promise.catch(() => this.cache.delete(key));
      this.cache.set(key, promise);
      while (this.cache.size > 6) {
        this.cache.delete(this.cache.keys().next().value);
      }
    }
    return this.cache.get(key);
  }

  /** Find the job file for an OctoPrint "fullPath" like "/local/foo/bar.gcode". */
  public findByPath(fullPath: string): Promise<LaserJobFile | null> {
    if (this.lastJob?.path === fullPath) return Promise.resolve(this.lastJob);
    return firstValueFrom(this.listJobs()).then(files => files.find(f => f.path === fullPath) ?? null);
  }

  //==== Selection ====//

  public getSelected(): Observable<SelectedJob> {
    return this.selected.asObservable();
  }

  public get selectedSnapshot(): SelectedJob {
    return this.selected.value;
  }

  public select(file: LaserJobFile): void {
    const current = this.selected.value;
    if (current?.file.path === file.path && current.file.date === file.date) return;
    this.selected.next({ file, parsed: null, loading: true, framed: false });
    this.getParsed(file)
      .then(parsed => {
        if (this.selected.value?.file === file) {
          this.selected.next({ ...this.selected.value, parsed, loading: false });
        }
      })
      .catch(err => {
        if (this.selected.value?.file === file) {
          this.selected.next({
            ...this.selected.value,
            loading: false,
            error: err?.message ?? tr('Não foi possível ler o ficheiro'),
          });
        }
      });
  }

  public markFramed(): void {
    if (this.selected.value) this.selected.next({ ...this.selected.value, framed: true });
  }

  /** Called whenever the work origin changes: a previous framing no longer applies. */
  public resetFramed(): void {
    if (this.selected.value?.framed) this.selected.next({ ...this.selected.value, framed: false });
  }

  public getLastJob(): LaserJobFile | null {
    return this.lastJob;
  }

  public start(file: LaserJobFile): Promise<boolean> {
    const path = file.path.split('/').map(encodeURIComponent).join('/');
    return firstValueFrom(
      this.http.post(
        this.configService.getApiURL('files' + path),
        { command: 'select', print: true },
        this.configService.getHTTPHeaders(),
      ),
    )
      .then(() => {
        this.lastJob = file;
        return true;
      })
      .catch(err => {
        this.notificationService.error(tr('Não foi possível iniciar o trabalho'), err?.message ?? String(err));
        return false;
      });
  }

  //==== Running job control ====//

  private jobCommand(command: string, action?: string): void {
    this.http
      .post(
        this.configService.getApiURL('job'),
        action ? { command, action } : { command },
        this.configService.getHTTPHeaders(),
      )
      .subscribe({
        error: err => this.notificationService.error(tr('Comando de trabalho falhou'), err?.message ?? String(err)),
      });
  }

  public pause(): void {
    this.jobCommand('pause', 'pause');
  }

  public resume(): void {
    this.jobCommand('pause', 'resume');
  }

  public cancel(): void {
    this.jobCommand('cancel');
  }
}
