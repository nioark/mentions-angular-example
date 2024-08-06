import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, input, OnInit, ViewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterOutlet } from '@angular/router';
import {OverlayModule} from '@angular/cdk/overlay';
import { Change, diffChars } from 'diff';


interface User {
  id: string
  display: string
}

interface Mention {
  user: User,
  text: string,
  str_start_index: number,
  str_end_index: number
}

interface ParserCase {
  text: string,
  type: "normal" | "parser",
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
    {id : '5', display : 'Jorge'},
    {id : '6', display : "Joao da silva"}
  ]

  currentMatches : User[] = [];
  SelectedMatchIndex = 0;

  SuggestionIndex = 0;

  mentions : Mention[] = [];

  @ViewChild('textarea') textarea: ElementRef<HTMLTextAreaElement> | undefined;

  constructor(private sanitizer: DomSanitizer, private changeDetectorRef: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    let caret_pos_changing_events = ['keypress', "keyup", 'mousedown', 'touchstart', 'input', 'paste', 'cut', 'mousemove', 'select', 'selectstart']
    console.log(this.textarea)
    for (const event of caret_pos_changing_events) {
      this.textarea?.nativeElement.addEventListener(event, () => {
        this.onCaretChange();
      })
    }
  }

  getJson() : string {
    return JSON.stringify(this.mentions)
  }

  get message() {
    return this._message;
  }
  set message(message: string) {
    this._message = message;
  }

  get highlights() : SafeHtml {
    // let mentions = this.getMentionDictToHighlight(this.message)
    let mentions = this.getMentionCases(this.message)

    let html = '';

    for (const mention of mentions) {
      if (mention.type === 'parser') {
        html += this.makeHilight(mention.text);
      } else {
        html += this.makeInvisible(mention.text);
      }
    }

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  getMentionDictToHighlight(inputString: string): ParserCase[] {
    return this.getAllSuggestionCases(inputString)
  }

  getMentionCases(str: string): ParserCase[] {
    let result: ParserCase[] = [];
  
    let lastIndex = 0;
    for (const obj of this.mentions) {
      if (obj.str_start_index > lastIndex) {
        result.push({text: str.substring(lastIndex, obj.str_start_index), type: "normal", start_index: lastIndex, end_index: obj.str_start_index});
      }
      result.push({text: str.substring(obj.str_start_index, obj.str_end_index + 1), type: "parser", start_index: obj.str_start_index, end_index: obj.str_end_index + 1});
      lastIndex = obj.str_end_index + 1;
    }
  
    if (lastIndex < str.length) {
      result.push({text: str.substring(lastIndex), type: "normal", start_index: lastIndex, end_index: lastIndex + str.length});
    }

    
    // result = result.sort((a, b) => a.start_index - b.start_index);
    // console.log(result)
    

    return result;
  }

  getAllSuggestionCases(inputString: string): ParserCase[] {
    const mentionRegex = /@\w+(?:\s\w+)*/g;

    return this._getMentionDict(inputString, mentionRegex);
  }

  _getMentionDict(inputString: string, regex: RegExp): ParserCase[] {
    const textParts = inputString.split(regex);
    const mentionParts = inputString.match(regex) || [];
  
    const result: ParserCase[] = [];

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
          type: "parser",
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
    return '<strong style="font-weight: inherit; background-color: rgb(206, 128, 229);">' + text + '</strong>';
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

  getAllSuggestion() : ParserCase[] {
    const mentions = this.getAllSuggestionCases(this.message).filter(mention => mention.type == "parser");

    return mentions 
  }

  getCurrentSuggestion() : ParserCase | undefined {
    const suggestions = this.getAllSuggestionCases(this.message).filter(mention => mention.type == "parser");

    let caret_position : number = this._getCursorPos();

    let suggestion_index = -1
    let mention_found : ParserCase | undefined = undefined

    suggestions.forEach((mention, index) => {
      if (caret_position >= mention.start_index && caret_position <= mention.end_index + 1) {
        suggestion_index = index
        mention_found = mention
      }
    })


    if (suggestion_index != -1 && mention_found) {
      let current_parser_case = mention_found as ParserCase
      this.SuggestionIndex = suggestion_index

      return current_parser_case
    } 

    return undefined
  }

  onChangedMessage($event: string) {
    let before_message = this.message
    this.message = $event;

    this.updateMentions(before_message, this.message); 
    this._process();
  }

  onCaretChange() {
    this._process();
  }

  updateMentions(before_message : string, now_message : string) {
    const differences_change = diffChars(before_message, now_message);

    
    interface ChangeIndex extends Change {
      index : number,
      count : number
    }
    
    let differences : ChangeIndex[] = []
    let index = 0;

    //Added index to each change
    differences_change.forEach((diff : Change) => {
      let count = diff.count ? diff.count : -9999

      differences.push({index: index, count: count, ...diff})
      if (diff.count){

        index += diff.count;
      } else {
        console.log("Não teve contagem")
      }

    })

    differences.forEach((diff : ChangeIndex) => {
      if (diff.removed || diff.added) {   
        this.mentions.map((mention) => {
          console.log(mention.str_start_index, diff.index)
          if (diff.index <= mention.str_start_index) {
            if (diff.added) {
              mention.str_start_index += diff.count
              mention.str_end_index = mention.str_start_index + mention.text.length
            } else if (diff.removed) {
              mention.str_start_index -= diff.count
              mention.str_end_index = mention.str_start_index + mention.text.length
            }
          } 
        })
      }

    })

    console.log(differences)
  }

  _process(){
    let suggestion = this.getCurrentSuggestion();

    if (suggestion) {

      let name = suggestion.text.substring(1);
      let matches = this._getPossibleMatch(name);

      this.currentMatches = matches ? matches : [];

      return
    }

    this.currentMatches = [];
    this.SelectedMatchIndex = 0;

  }

  _setCursorPos(index: number) {
    if (this.textarea) {
      setTimeout(() => {
        if (this.textarea) {
          console.log("Setting cursor: ", index);
          this.textarea.nativeElement.selectionStart = index;
          this.textarea.nativeElement.selectionEnd = index;
        }
      }, 100);
    }
  }

  _getCursorPos() {
   return this.textarea ? this.textarea.nativeElement.selectionStart : 0;
  }

  /*



  onRemoveEvent() {
    if (!this.currentMention) return

    console.log("Removing: ", this.currentMention);

    this.mentionsProcessed.splice(this.currentMention.index, 1);
    this.showMatches = false;
    // if (this.currentMention.user && !this.currentMention.ended) {
    //   const start_index = this.currentMention.str_start_index + 1;
    //   const end_index = this.currentMention.str_end_index;
    //   const before = this.message.substring(0, start_index);
    //   const after = this.message.substring(end_index, this.message.length);

    //   this._setCursorPos(start_index);
    //   this.message = before + after;
    //   this.changeDetectorRef.detectChanges();
    // }
    
  }
  */

  onChooseEvent(indexTo: number) {
    if (this.currentMatches.length == 0) return;

    this.SelectedMatchIndex += indexTo;
    this.SelectedMatchIndex = Math.max(0, Math.min(this.SelectedMatchIndex, this.currentMatches.length - 1));
  }

  onSelectEvent(event: KeyboardEvent) {
    if (this.currentMatches.length == 0) return;

    event.preventDefault();
    this.processSelectedMention(this.currentMatches[this.SelectedMatchIndex]);
  }

  _insertMention(user: User, start_index: number, end_index: number) {
    this.mentions.push({user, text: user.display, str_start_index: start_index, str_end_index: end_index});
        
    this.mentions = this.mentions.sort((a, b) => {
      if (a.str_start_index > b.str_start_index) return 1;
      if (a.str_start_index < b.str_start_index) return -1;
      return 0;
    })
  }

  processSelectedMention(user : User) {
    let current_sugestion = this.getCurrentSuggestion();
    if (current_sugestion) {
        let start_index = current_sugestion.start_index;
        let end_index = current_sugestion.end_index;

        this._removeSelectionFromMessage(start_index, end_index);

        this._insertIntoMessage(start_index, start_index, user.display);

        let inserted_start_index = start_index
        let inserted_end_index = start_index + user.display.length;

        this._setCursorPos(inserted_end_index);

        this._insertMention(user, inserted_start_index, inserted_end_index - 1);
        
    }
  }

  _removeSelectionFromMessage(start_index: number, end_index: number) {
    let before = this.message.substring(0, start_index);
    let after = this.message.substring(end_index, this.message.length);
    this.onChangedMessage(before + after);
    this.changeDetectorRef.detectChanges();
  }

  _insertIntoMessage(start_index: number, end_index: number, text: string) {
    const before = this.message.substring(0, start_index);
    const after = this.message.substring(end_index, this.message.length);

    console.log("Inserido texto")
    this.onChangedMessage(before + text+ after);

    this.changeDetectorRef.detectChanges();
  }

  onKeydown(event: KeyboardEvent) {

    this._process();
    
    if (event.code == "ArrowUp" || event.code == "ArrowDown") {
      event.preventDefault();
      let indexTo = event.code == "ArrowUp" ? -1 : 1;
  
      this.onChooseEvent(indexTo);
    }

    if (event.code == "Space") {
      this.onSelectEvent(event);
    }


  //   if (event.code == "Backspace") {
  //     this.onRemoveEvent();
  //   }
  }
}
