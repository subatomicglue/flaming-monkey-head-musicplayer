import { CoreModule } from './../core/core.module';
import { Component, OnInit, NgZone, HostListener, OnChanges, EventEmitter, Self,/*, SimpleChanges*/ } from '@angular/core';
import { Location } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ElectronService } from '../core/services/electron/electron.service';
import * as WebAudioAPISound from '../../../app/WebAudioAPISound';
import { getDefaultLibFilePath } from 'typescript/lib/tsserverlibrary';
import { convertCompilerOptionsFromJson } from 'typescript';
import AbortablePromise from "promise-abortable";



@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit/*, OnChanges*/ {
  files = [];
  image_dict = {};
  defaultpath = "/Users/kevinmeinert/Downloads/4Jameel";
  path = this.defaultpath;
  type = "dir";
  status = false;
  static default_art = '/assets/default.png';
  art = HomeComponent.default_art;
  static default_playing = { index: 0, track: { "path": "", "fullpath": "", "type": "dir", image: '/assets/default' }, listing: { image_dict: { ["/assets/default"]: "/assets/default.png" }, listing: [] } };
  playing = HomeComponent.default_playing;
  currentTime = "--:--"
  progressamt = "0%";
  listing: any = {};
  listing_roots = {
    image_dict: { ["/assets/default"]: "/assets/default.png" },
    listing: [
      { "path":"assorted", "fullpath":"/Users/kevinmeinert/Downloads/assorted", "type": "dir", "ext": "", image: '/assets/default' },
      { "path":"4Jameel", "fullpath":"/Users/kevinmeinert/Downloads/4Jameel", "type": "dir", "ext": "", image: '/assets/default' },
      { "path":"4Dave",   "fullpath":"/Users/kevinmeinert/Downloads/4Dave",   "type": "dir", "ext": "", image: '/assets/default' },
      { "path":"music",   "fullpath":"/Volumes/music",                        "type": "dir", "ext": "", image: '/assets/default' },
    ]
  }

  constructor(private router: Router, private route: ActivatedRoute, private location: Location, private electronService: ElectronService, private zone:NgZone) {
  }

  static getExt( filename ) {
    let m = filename.match( /\.[^\.]+$/ );
    //console.log( path, m )
    return m ? m[0] : ""
  }

  static getPath( filepath ) {
    return filepath.replace( /\/[^\/]+$/, "" )
  }

  static getFilename( filepath ) {
    return filepath.replace( /^.*\//, "" ).replace( /\.[^\.]+$/, "" ); // remove path and ext
  }

  ngOnInit(): void {
    console.log('[HomeComponent] ngOnInit()');
    this.route.queryParams.subscribe(queryParams => {
      let p = queryParams['p'] ? decodeURIComponent( queryParams['p'] ) : this.defaultpath;
      let t = queryParams['t'] ? decodeURIComponent( queryParams['t'] ) : "dir";
      this.path = p;
      this.type = t;

      // filter ".." dirs out of the path:   /path/to/..
      this.path = this.path.replace( /\/[^/]+\/\.\./g, "" );   if (this.path.length == 0) this.path = "/";
      this.init();
    });

    //this.init();
  }

  back() {
    this.location.back();
  }

  async click( f, i, listing ) {
    if (f.type == "dir") {
      console.log( "[changeroute]", f.fullpath, f.type, i );
      this.router.navigate( ['/home'], { queryParams : {p: f.fullpath, t: f.type, i: i} })
    } else {
      await this.playAudio( f, i, listing )
    }
  }

  async init() {
    //let exists = await this.electronService.ipcRenderer.invoke( 'fs', 'existsSync', this.path )
    //this.files = await this.electronService.ipcRenderer.invoke( 'fs', 'readdirSync', this.path + "/" + f )
    //this.status = await this.electronService.ipcRenderer.invoke( 'fs.statSync', this.path, 'isDirectory' )
    this.refreshListing();

    // for (let element of document.getElementsByClassName('listing')) {
    //   element.addEventListener('scroll', e => {
    //       console.log(e.target.scrollLeft, e.target.scrollTop);
    //   });
    // }
  }

  async refreshListing() {
    // detect if we've gone above any of the "root paths":
    let which_root = this.listing_roots.listing.filter( r => this.path.match( new RegExp( "^" + r.fullpath.replace( /\//g, '\\/' ) ) ) )
    if (which_root.length == 0) {
      console.log( "out of bounds, displaying root list" )
      this.listing = this.listing_roots;
    } else {
      this.listing = await this.electronService.ipcRenderer.invoke( 'getListing', (this.type == "file") ? HomeComponent.getPath( this.path ) : this.path )
      this.fillInMissingDurations();
      if (this.listing.listing.length == 0) {
        console.log( "no listing, displaying root list" )
        this.listing = this.listing_roots;
      }
    }
    this.image_dict = this.listing.image_dict;
    this.files = this.listing.listing;
    this.art = this.image_dict['Folder'] ? this.image_dict['Folder'] : HomeComponent.default_art;
    //console.log( this.listing )
    //console.log( this.playing )
  }

  ngAfterViewInit() {
    this.scrollTo( "listing" );
  }

  scrollTo( elementID, delay_msec = 0 ) {
    setTimeout( () => {
      if (document.getElementById(elementID))
        document.getElementById(elementID).scrollIntoView({
          behavior: "smooth",
          //block: "start", // the top of the element will be aligned to the top of the visible area of the scrollable ancestor
          //block: "end",     // the bottom of the element will be aligned to the bottom of the visible area of the scrollable ancestor
          block: "center",
          inline: "nearest"
        });
    }, delay_msec );
  }

  // call this without await so it runs in the background
  // it's atomic, meaning it will cancel previous instances automatically
  fillInMissingDurations_AbortablePromise: AbortablePromise = undefined;
  fillInMissingDurations(): AbortablePromise {
    let running = true;
    if (this.fillInMissingDurations_AbortablePromise)
      this.fillInMissingDurations_AbortablePromise.abort();

    this.fillInMissingDurations_AbortablePromise = new AbortablePromise( async (rs, rj, sig) => {
      sig.onabort = () => { running = false; rs(); }

      for (let i = 0; i < this.listing.listing.length && running; ++i) {
        if (this.listing.listing[i].runningtime === "??" && this.listing.listing[i].type == "file" && this.listing.listing[i].ext.match( /(m4a|mp3|aac|wav)$/ ) && running) {
          console.log( "Computing running time for: ", this.listing.listing[i].fullpath )
          let result = await this.electronService.ipcRenderer.invoke( 'getRunningTime', this.listing.listing[i].fullpath )

          // this is the part that could crash if aborted..., just guard it if we've aborted...
          if (result && i < this.listing.listing.length && running) {
            this.listing.listing[i].duration = result.duration;
            this.listing.listing[i].runningtime = result.runningtime;
          }
        }
      }
    });
  }



  isPlaying() { return !this.audio.paused; }

  static formatTime(seconds: number): string {
    let minutes: any = Math.floor(seconds / 60);
    let secs: any = Math.floor(seconds % 60);
    if (minutes < 10) {
      minutes = '0' + minutes;
    }
    if (secs < 10) {
      secs = '0' + secs;
    }
    return minutes +  ':' + secs;
  }

  track_play() {
    this.audio.volume = 1;
    this.audio.play();
    this.updateTrackTime();

    // this.timer = setInterval( () => {
    //   this.currentTime = HomeComponent.formatTime( this.audio.currentTime );
    // }, 1000 );
  }
  track_pause() {
    this.audio.pause();

    // clearInterval( this.timer );
    // this.timer = undefined;
  }
  track_inc( inc ) {
    if (inc < 0 && 2 <= this.audio.currentTime) {
      this.audio.currentTime = 0;
    } else {
      this.audio.volume = 0;
      this.zone.run( () => {
        let i = this.playing.index;
        let next_i = this.track_search_next( i, inc, this.modes[this.mode] == "repeat_all" );
        if (0 <= next_i && next_i <= (this.playing.listing.listing.length - 1)) {
          //console.log( i, next_i, (this.playing.listing.listing.length - 1), this.playing.listing.listing[next_i], this.playing.listing )
          this.playAudio( this.playing.listing.listing[next_i], next_i, this.playing.listing )
        }
        else
          this.track_stop();
      });
    }
  }
  track_next() { this.track_inc( 1 ); }
  track_prev() { this.track_inc( -1 ); }
  track_stop() {
    this.audio.pause();
    //this.audio.currentTime = 0;

    clearInterval( this.timer );
    this.timer = undefined;

    delete this.audio;
  }
  track_search_next( i, dir=1, wrap = false ) {
    let next_i = wrap ? (i + dir) % (this.playing.listing.listing.length - 1) : i + dir;
    while (0 <= next_i && next_i <= (this.playing.listing.listing.length - 1)) {
      if (this.playing.listing.listing[next_i].type == "file" && this.playing.listing.listing[next_i].ext.match( /(m4a|mp3|aac|wav)/ )) {
        return next_i;
      }
      next_i += dir;
    }
    return -1;
  }

  modes = [
    "play_all", "play_1", "repeat_1", "repeat_all",
  ]
  modes_repeaticon = [
    "play_black_24dp", "play_one_black_24dp", "repeat_one_black_24dp", "repeat_black_24dp",
  ]
  mode = 0;
  timer;
  audio;
  async playAudio( f, i, listing ) {
    if (this.audio) this.track_stop();
    this.audio = new Audio();
    this.playing.index = i;
    this.playing.track = f;
    this.playing.listing = listing;
    //this.current_index = i;
    //console.log( f.fullpath, i )
    let data = await this.electronService.ipcRenderer.invoke( 'readFileSync', f.fullpath );
    //console.log( data )
    this.audio.src = data;
    this.audio.load();

    // auto next track, when track ends:
    this.audio.onended = (event) => {
      this.audio.volume = 0;
      this.zone.run(() => {
        let i = this.playing.index;
        let next_i = i;
        console.log( "Track Ended (processing repeat mode): ", this.modes[this.mode] );
        switch (this.modes[this.mode]) {
          case "play_1": next_i = i; break;
          case "repeat_1": next_i = i; break;
          case "repeat_all": next_i = this.track_search_next( i, 1, true ); break;
          case "play_all": next_i = this.track_search_next( i, 1, false ); break;
        }
        if (this.modes[this.mode] != "play_1" && (0 <= next_i && next_i < this.playing.listing.listing.length)) {
          this.playAudio( this.playing.listing.listing[next_i], next_i, this.playing.listing )
          //this.scrollTo( "item" + next_i );
        } else {
          this.progressamt = "0%"
          this.currentTime = "--:--"
          setTimeout( () => { this.track_stop() }, 1000 );
        }
      });
    }

    // update the progress time display
    this.audio.ontimeupdate = (event) => {
      this.zone.run(() => {
        this.updateTrackTime();
      });
    };

    // ramp the audio to silence before it ends...
    let volume_ramp_granularity = 0.01;
    let volume_ramp_time = 0.12;
    if (this.timer) clearInterval( this.timer );
    this.timer = setInterval( () => {
      //console.log( this.audio.currentTime, this.audio.duration < (this.audio.currentTime + volume_ramp_time) )
      if (this.audio.duration < (this.audio.currentTime + volume_ramp_time)) {
        this.audio.volume = 0;
      }
    }, volume_ramp_granularity * 1000 );

    this.track_play();
    this.scrollTo( "item" + i )
  }

  updateTrackTime() {
    this.currentTime = this.audio ? HomeComponent.formatTime( this.audio.currentTime ) : "--:--"
    this.progressamt = this.audio ? `${this.audio.currentTime == 0 ? 0 : (this.audio.currentTime / this.audio.duration) * 100}%` : '0%';
    //console.log( "progress:", this.progressamt, "time:", this.currentTime );
  }

  toggleMode() {
    this.mode = (this.mode + 1) % (this.modes.length)
  }
  // async click2( f ) {

  //   if (f.type == "dir") {
  //     //console.log( "before", this.path )
  //     this.path = this.path + "/" + f.path
  //     this.path = this.path.replace( /\/\//g, "/" ); // collapse any duplicate /'s in the path
  //     this.path = this.path.replace( /\/[^/]+\/\.\./g, "" ); // collapse the ..'s in the path
  //     if (this.path == "") this.path = "/"
  //     //console.log( "after", this.path )
  //     this.refreshListing();
  //   } else {
  //     await this.playAudio( f.fullpath )
  //   }
  // }

  async onKeyDown( e:KeyboardEvent ) {
    if (e.code=="Space") {
      this.isPlaying() ? this.track_pause() : this.track_play()
    }
    e.preventDefault();
  }

  progress_manipulating = false;
  progressMove( e ){
    if (this.progress_manipulating) {
      let amt = e.x / e.srcElement.clientWidth;
      this.audio.currentTime = this.audio.duration * amt;
      this.updateTrackTime();
      //console.log( "progress interaction", amt )
    }
  }
  progressStart(e) { this.progress_manipulating = true; this.progressMove( e ); /*console.log( "progress start" )*/ }
  progressEnd(e) { this.progress_manipulating = false; this.progressMove( e ); /*console.log( "progress end" )*/ }
}
