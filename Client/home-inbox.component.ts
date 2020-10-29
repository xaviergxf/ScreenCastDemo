import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { HubConnectionBuilder, LogLevel, HubConnection, Subject } from '@microsoft/signalr';
import { environment } from '@root/environments/environment';

@Component({
  selector: 'app-home-inbox',
  templateUrl: './home-inbox.component.html',
  styleUrls: ['./home-inbox.component.css']
})
export class HomeInboxComponent implements OnInit, AfterViewInit {

  @ViewChild('startCast') startCast: ElementRef;
  @ViewChild('stopCast') stopCast: ElementRef;
  @ViewChild('video') video: ElementRef;
  connection: HubConnection;
  isStreaming: boolean = false;
  subject: Subject<string>;
  framepersecond = 30;
  screenCastTimer: NodeJS.Timeout;
  streamCasters: string[];
  screenShareUrl: SafeUrl;
  mediaRecorder?: MediaRecorder;
  sourceBuffer: SourceBuffer;
  mediaSource: MediaSource;
  bufferQueue: Uint8Array[] = [];
  mediaStream: MediaStream | null = null;

  constructor(private sanitizer: DomSanitizer) { }

  ngAfterViewInit(): void {
    this.mediaSource = new MediaSource();
    this.video.nativeElement.src = window.URL.createObjectURL(this.mediaSource);
    this.video.nativeElement.muted = true;
    this.mediaSource.addEventListener('sourceopen', (e) => {
      this.sourceBuffer = this.mediaSource.addSourceBuffer('video/webm; codecs="vp8"');
      this.sourceBuffer.addEventListener('update', () => {
        this.readFromBufferQueue();
      });
    });
  }

  ngOnInit() {
    this.connection = new HubConnectionBuilder()
      .withUrl(environment.webApis.DemoRTC + '/ScreenCastHub')
      .configureLogging(LogLevel.Information)
      .build();

    this.connection.on("OnStreamCastDataReceived", (data) => {
      this.storeReceivedData(data);
    })

    this.connection.start().then(() => {
      console.log("connected");
    });
  }

  storeReceivedData(data: string) {
    const buffer = Uint8Array.from(atob(data), c => c.charCodeAt(0));
    this.bufferQueue.push(buffer);
    this.readFromBufferQueue();
  }

  readFromBufferQueue() {
    if (this.sourceBuffer && this.mediaSource.readyState === "open" && this.sourceBuffer.updating === false && this.bufferQueue.length > 0) {
      this.bufferQueue.splice(0, this.bufferQueue.length - 1);
      const buffer = this.bufferQueue.pop();
      if (buffer)
        this.sourceBuffer.appendBuffer(buffer);
    }

    // Limit the total buffer size to 20 minutes
    // This way we don't run out of RAM
    if (this.video.nativeElement.buffered.length && this.video.nativeElement.buffered.end(0) - this.video.nativeElement.buffered.start(0) > 30) {
      this.sourceBuffer.remove(0, this.video.nativeElement.buffered.end(0) - 30);
    }
  }

  startCasting() {
    this.subject = new Subject();
    this.connection.send("StreamCastData", this.subject);
    try {
      const mediaDevices = navigator.mediaDevices as any;
      const stream = mediaDevices.getDisplayMedia();
      stream.then((ms: MediaStream) => {
        this.mediaStream = ms;
        this.mediaRecorder = new window.MediaRecorder(ms, { mimeType: 'video/webm; codecs="vp8"' });
        this.mediaRecorder.ondataavailable = (blobEvent: BlobEvent) => {
          const blob = blobEvent.data;
          blob.stream()
          var reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = () => {
            var base64data = reader.result;
            if (typeof (base64data) === 'string') {
              const separatorIndex = base64data.indexOf(',');
              if (separatorIndex >= 0) {
                base64data = base64data.substr(separatorIndex + 1);
                this.subject.next(base64data);
              }
            }
          };
        };
        this.mediaRecorder.start();
        this.screenCastTimer = setInterval(() => {
          if (this.mediaRecorder)
            this.mediaRecorder.requestData();
        }, Math.round(1000 / this.framepersecond));
        this.isStreaming = true;
      });
    } catch (e) {
      console.log(e);
    }
  }

  stopCasting() {
    if (this.isStreaming) {
      clearInterval(this.screenCastTimer);
      this.subject.complete();
      if (this.mediaRecorder) {
        this.mediaRecorder.stop();
      }
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(v => {
          v.stop();
        });
        this.mediaStream = null;
      }
      this.isStreaming = false;
    }
  }

}
