import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterOutlet } from '@angular/router';

interface User {
  id: string
  display: string
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  
})

export class AppComponent {
  title = 'mentions';

  _message : string = '';

  users_to_mention : User[] = [
    {id : '1', display : 'John'},
    {id : '2', display : 'Jane'},
    {id : '3', display : 'Bob'},
  ]

  constructor(private sanitizer: DomSanitizer) {}

  get message() {
    return this._message;
  }
  set message(message: string) {
    this._message = message;
  }

  get highlights() : SafeHtml {
    let mentions = this.convertStringToMentionDict(this.message)

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

  convertStringToMentionDict(inputString: string): { text: string, type: string }[] {
    const mentionRegex = /@\w+/g;
    const textParts = inputString.split(mentionRegex);
    const mentionParts = inputString.match(mentionRegex) || [];
  
    const result: { text: string, type: string }[] = [];
  
    for (let i = 0; i < textParts.length; i++) {
      const textPart = textParts[i];
      const mentionPart = mentionParts[i];
  
      if (textPart) {
        result.push({ text: textPart, type: "normal" });
      }
  
      if (mentionPart) {
        result.push({ text: mentionPart, type: "mention" });
      }
    }

    return result;
  }
  
  makeInvisible(text : string) : string {
    return '<span style="visibility: hidden;">' + text + '</span>'
  }

  makeHilight(text : string) : string {
    return '<strong style="font-weight: inherit; background-color: rgb(206, 228, 229);">' + text + '</strong>';
  }

  _get_possible_match(name: string) : User | undefined {
    for (const user of this.users_to_mention) {
      let display_name = user.display.toLocaleLowerCase()
      if (display_name.startsWith(name)) {
        return user;
      }
    }

    return undefined
  }

  on_a_match = false;
  possible_match : User | undefined;

  onMessageChange(message: string) {
    this.message = message;

    const mentions = this.convertStringToMentionDict(message);
    const lastMention = mentions[mentions.length - 1];
    if (lastMention.type == "mention") {
      let name = lastMention.text.substring(1).toLocaleLowerCase();
      this.possible_match = this._get_possible_match(name)
      this.on_a_match = true;
    } else {
      this.possible_match = undefined
      this.on_a_match = false
    }
  }

  onKeydown(event: KeyboardEvent) {
    console.log(event);

    if (!this.on_a_match && !this.possible_match) return 

    if (event.key == "Enter" || event.key == "Space") {
      event.preventDefault();
      
      console.log("Selected match: ", this.possible_match);
    }
  }
}
