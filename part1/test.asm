bits 16

; listing 38
mov cx, bx
mov ch, ah
mov dx, bx
mov si, bx
mov bx, di
mov al, cl
mov ch, ch
mov bx, ax
mov bx, si
mov sp, di
mov bp, ax

; Register-to-register
mov si, bx
mov dh, al

; 8-bit immediate-to-register
mov cl, 12
mov ch, -12

; 16-bit immediate-to-register
mov cx, 12
mov cx, -12
mov dx, 3948
mov dx, -3948

; Source address calculation
mov al, [bx + si]
mov bx, [bp + di]
mov dx, [bp]