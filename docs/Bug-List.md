# Bug List
 - Including a percent sign ```%``` in the room name causes an error
   - Expectation: Room loads normally.
   - Severity: **Minor**
   - Complexity to fix: **Low**
 - Including a back-slash ```\``` in the room name causes an error
   - Expectation: Room loads normally.
   - Severity: **Minor**
   - Complexity to fix: **Low**
 - Starting a room name with a question mark ```?``` causes nothing to happen.
   - Expectation: Room loads normally.
   - Severity: **Minor**
   - Complexity to fix: **Low**
 - Starting a line in chat with a forward-slash ```/``` causes the text to not appear, even if it isnt a command.
   - Expectation: Chat to appear as long as text following ```/``` isn't a command. Alternative: A help menu appear listing possible commands.
   - Severity: **Minor**
   - Complexity to fix: **Low**
 - More then 3 people joining a ```m-``` room causes the moustache and monacle to appear in the middle of the screen, not over a persons face.
   - Expectation: Moustache and monacle appear over the person in the top left, or over everyone.
   - Severity: **Critical**
   - Complexity to fix: **High**