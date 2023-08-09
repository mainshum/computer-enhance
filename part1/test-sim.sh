# assemble test.asm, creates test
cd part1
nasm test.asm
# use sim to make temp asm file
deno run --allow-read sim8086.ts test > my.asm
# assemble my.asm, creates my
nasm my.asm

# comparison
if cmp -s my test
then    
    echo "Success"
else 
    echo "Fail"
    cmp my test
fi