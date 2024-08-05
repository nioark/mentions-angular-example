import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, input, OnInit, ViewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterOutlet } from '@angular/router';
import {OverlayModule} from '@angular/cdk/overlay';


interface User {
  id: string
  display: string
}

interface Mention {
  user: User | undefined,
  text: string,
  index: number,
  ended: boolean,
  str_start_index: number,
  str_end_index: number
}

interface MentionCase {
  text: string,
  type: string,
  start_index: number,
  end_index: number
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, FormsModule, ReactiveFormsModule, OverlayModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  
})

export class AppComponent implements AfterViewInit {
  title = 'mentions';

  _message : string = '';

  users_to_mention : User[] = [
    {id : '1', display : 'John'},
    {id : '2', display : 'Jane'},
    {id : '3', display : 'Bob'},
    {id : '4', display : 'Joao'},
    {id : '5', display : 'Jorge'}
  ]

  showMatches = false;

  currentMatches : User[] = [];
  selectedMatchIndex = 0;

  mentionsProcessed : Mention[] = [];
  currentMention : Mention | undefined;

  @ViewChild('textarea') textarea: ElementRef<HTMLTextAreaElement> | undefined;

  constructor(private sanitizer: DomSanitizer, private changeDetectorRef: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    let caret_pos_changing_events = ['keypress', 'mousedown', 'touchstart', 'input', 'paste', 'cut', 'mousemove', 'select', 'selectstart']
    console.log(this.textarea)
    for (const event of caret_pos_changing_events) {
      this.textarea?.nativeElement.addEventListener(event, () => {
        this.onCaretChange();
      })
    }
  }

  getJson() : string {
    return JSON.stringify(this.mentionsProcessed)
  }

  get message() {
    return this._message;
  }
  set message(message: string) {
    this._message = message;
  }

  get highlights() : SafeHtml {
    let mentions = this.getMentionDictToHighlight(this.message)

    let html = '';

    for (const mention of mentions) {
      if (mention.type === 'mention') {
        html += this.makeHilight(mention.text);
      } else {
        html += this.makeInvisible(mention.text);
      }
    }

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  getMentionDictToHighlight(inputString: string): MentionCase[] {
    return this.getAllMentionCases(inputString)
  }

  getMentionDictFromNames(inputString: string, names : string[]): { text: string, type: string }[] {
    const regex = new RegExp(names.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join("|"));
    console.log("Regex for names: ", regex);

    return this._getMentionDict(inputString, regex);
  }

  getAllMentionCases(inputString: string): MentionCase[] {
    const mentionRegex = /@\w+(?:\s\w+)*/g;

    return this._getMentionDict(inputString, mentionRegex);
  }

  _getMentionDict(inputString: string, regex: RegExp): MentionCase[] {
    const textParts = inputString.split(regex);
    const mentionParts = inputString.match(regex) || [];
  
    const result: MentionCase[] = [];

    for (let i = 0; i < textParts.length; i++) {
      const textPart = textParts[i];
      const mentionPart = mentionParts[i];
  
      if (textPart) {
        result.push({
          text: textPart,
          type: "normal",
          start_index: 0,
          end_index: 0,
        });
      }
  
      if (mentionPart) {
        result.push({
          text: mentionPart,
          type: "mention",
          start_index: 0,
          end_index: 0,
        });
      }
    }
  
    let currentIndex = 0;
  
    result.map((item) => {
      item.start_index = currentIndex;
      item.end_index = currentIndex + item.text.length;
      currentIndex += item.text.length;
    })
    
    return result;
  }
  
  makeInvisible(text : string) : string {
    return '<span style="visibility: hidden;">' + text + '</span>'
  }

  makeHilight(text : string) : string {
    return '<strong style="font-weight: inherit; background-color: rgb(206, 228, 229);">' + text + '</strong>';
  }

  _getPossibleMatch(name: string) : User[] | undefined {
    let users : User[] = [];

    for (const user of this.users_to_mention) {
      let display_name = user.display.toLocaleLowerCase()
      if (display_name.startsWith(name)) {
        users.push(user);
      }
    }

    if (users.length > 0) {
      return users
    }

    return undefined
  }

  getCurrentMention() : Mention | undefined {
    const mentions = this.getAllMentionCases(this.message).filter(mention => mention.type == "mention");

    let caret_position : number = this.textarea ? this.textarea.nativeElement.selectionStart : 0;

    let mention_index = -1
    let mentionFound : MentionCase | undefined = undefined

    mentions.forEach((mention, index) => {
      if (caret_position >= mention.start_index && caret_position <= mention.end_index + 1) {
        mention_index = index
        mentionFound = mention
      }
    }) 

    console.log(mentions)

    if (mention_index != -1 && mentionFound) {
      if (this.mentionsProcessed[mention_index]) {
        return this.mentionsProcessed[mention_index]
      }

      let currentMention = mentionFound as MentionCase

      let name = currentMention.text.substring(1).toLocaleLowerCase();

      let possible_matches = this._getPossibleMatch(name);
      let possible_match = possible_matches ? possible_matches[0] : undefined;

      this.currentMatches = possible_matches || [];

      let mention : Mention = {
        text: currentMention.text,
        user: possible_match,
        index: mention_index,
        str_start_index: currentMention.start_index,
        str_end_index: currentMention.end_index,
        ended: false
      }

      return mention
    } 

    return undefined
  }


  onChangedMessage($event: string) {
    this.message = $event;
    this._process();
  }

  onCaretChange() {
    this._process();
  }

  _process(){
    let mention = this.getCurrentMention();
    this.currentMention = mention;

    if (this.currentMention && !this.currentMention.ended) {
      this.showMatches = true;
    } else {
      this.showMatches = false
    }
  }

  onSelectEvent() {
    if (!this.currentMention) return

    if (this.currentMention.ended) return

    if (this.currentMatches.length > 0) {
      let found_user = this.currentMatches[this.selectedMatchIndex];
      if (found_user){
        this.currentMention.text = '@' + found_user.display
        this.currentMention.str_end_index = this.currentMention.str_end_index + this.currentMention.text.length + 1
        this.currentMention.user = found_user;
      }
    }

    this.currentMention.ended = true;

    if (!this.mentionsProcessed[this.currentMention.index]) {
      this.mentionsProcessed.push(this.currentMention);
    } else {
      this.mentionsProcessed[this.currentMention.index] = this.currentMention
    }

    if (this.currentMention.user) {
      const start_index = this.currentMention.str_start_index + 1;
      const end_index = this.currentMention.str_end_index;
      const before = this.message.substring(0, start_index);
      const after = this.message.substring(end_index, this.message.length);
      this.message = before + this.currentMention.user.display + after;
      this.changeDetectorRef.detectChanges();
      this._setCursorPos(end_index);
    }
    
    this.selectedMatchIndex = 0;

  }

  onChooseEvent(indexTo: number) {

    if (this.currentMatches.length == 0) return;

    this.selectedMatchIndex += indexTo;
    this.selectedMatchIndex = Math.max(0, Math.min(this.selectedMatchIndex, this.currentMatches.length - 1));

    // this.mentionsProcessed[indexTo] = mention;
  }
  _setCursorPos(index: number) {
    if (this.textarea) {
      this.textarea.nativeElement.selectionStart = index;
      this.textarea.nativeElement.selectionEnd = index;
    }
  }

  onRemoveEvent() {
    if (!this.currentMention) return

    console.log(this.currentMention)

    this.mentionsProcessed.splice(this.currentMention.index, 1);
    this.showMatches = false;
    if (this.currentMention.user) {
      const start_index = this.currentMention.str_start_index + 1;
      const end_index = this.currentMention.str_end_index;
      const before = this.message.substring(0, start_index);
      const after = this.message.substring(end_index, this.message.length);

      this._setCursorPos(start_index);
      this.message = before + after;
      this.changeDetectorRef.detectChanges();
    }
    
  }

  onKeydown(event: KeyboardEvent) {

    this._process();

    if (!this.currentMention) return;
    
    //Selected the mention event
    if (event.code == "Space") {
      this.onSelectEvent();
    }

    if (event.code == "ArrowUp" || event.code == "ArrowDown") {
      event.preventDefault();
      let indexTo = event.code == "ArrowUp" ? -1 : 1;

      this.onChooseEvent(indexTo);
    }

    if (event.code == "Backspace") {
      this.onRemoveEvent();
    }
  }
}
