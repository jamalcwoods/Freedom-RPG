const { createCanvas, loadImage } = require('canvas')
const canvas = createCanvas(1440, 720)
const ctx = canvas.getContext('2d')

let images = {}

function toggleShadows(toggle){
    switch(toggle){
    	case true:
            ctx.shadowOffsetX = -4;
            ctx.shadowOffsetY = 4;
            ctx.shadowBlur = 8;
            ctx.shadowColor = "black";
          break;
         
        case false:
        	ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            ctx.shadowBlur = 0;
            break;
    }
}

function drawAbilityBox(ability,x,y){
    toggleShadows(true);
    ctx.fillStyle = '#6473A6';
    ctx.strokeRect(x, y, 250, 175);
    ctx.fillRect(x, y, 250, 175);
    toggleShadows(false);

    ctx.fillStyle = '#000000';

    if(ability != undefined){
        ctx.font = '30px Impact'
        ctx.textAlign = "left"
        ctx.fillText(ability.name,x + 5,y+30)
        switch(ability.action_type){
            case "attack":
                ctx.textAlign = "left"

                ctx.drawImage(images.icon, x + 40, y + 69,32,32);
                ctx.fillText("Damage: " + ability.damage_val,x + 75,y + 97)
                
                ctx.textAlign = "center"
                ctx.font = '24px Impact'
                ctx.drawImage(images.attack_accuracy, x + 35, y + 115,24,24);
                ctx.fillText(ability.accuracy + "%",x +45,y + 165)
                
                let speedText = ""
                switch(ability.speed ){
                    case 0:
                        speedText = "Slow"
                        break;
                    case 1:
                        speedText = "Normal"
                        break;
                    case 2:
                        speedText = "Quick"
                        break;
                    case 3:
                        speedText = "Fast"
                        break;
                }
                ctx.drawImage(images.attack_speed, x + 115, y + 115,24,24);
                ctx.fillText(speedText,x + 125,y + 165)
                
                ctx.drawImage(images.attack_critical, x + 195, y + 115,24,24);
                ctx.fillText(ability.critical + "%",x + 205,y + 165)
                
                ctx.drawImage(images.icon, x + 212, y + 3,32,32);
                break;
                
            case "guard":
                ctx.textAlign = "left"
                ctx.drawImage(images.icon, x + 40, y + 69,32,32);
                ctx.fillText("Guard: " + ability.guard_val,x + 75,y + 97)
                
                ctx.textAlign = "center"
                ctx.font = '24px Impact'
                ctx.drawImage(images.guard_counter, x + 35, y + 115,24,24);
                ctx.fillText(ability.counter_val,x +45,y + 165)
                
                ctx.drawImage(images.guard_success, x + 195, y + 115,24,24);
                ctx.fillText(ability.success_level,x + 205,y + 165)
                
                break;
        }
    } else {
        ctx.font = '30px Impact'
        ctx.textAlign = "center"
        ctx.fillText("No Ability",x + 125,y + 175/2)
    }
}

function makeCard(player,avatar,callback){
    var attack = {
        "critical" : 0,
        "damage_type" : "atk",
        "damage_val" : 10,
        "name" : "test attack",
        "speed" : 1,
        "faction" : -1,
        "action_type":"attack",
        "accuracy":100
    }

    var guard = {
            "action_type":"guard",
            "name":"test guard",
            "guard_val":40,
            "success_level":0,
            "counter_val":0,
            "counter_type":"def",
            "speed":3
        }

    let imagePromises = [
        loadImage("./icons/dmgIcon_atk.png").then(img =>{
            return img
        }),
        loadImage("./icons/dmgIcon_spatk.png").then(img =>{
            return img
        }),
        loadImage("./icons/guardIcon_atk.png").then(img =>{
            return img
        }),
        loadImage("./icons/guardIcon_spatk.png").then(img =>{
            return img
        }),
        loadImage("./icons/attack_accuracy.png").then(img =>{
            return img
        }),
        loadImage("./icons/attack_critical.png").then(img =>{
            return img
        }),
        loadImage("./icons/attack_speed.png").then(img =>{
            return img
        }),
        loadImage("./icons/guard_counter.png").then(img =>{
            return img
        }),
        loadImage("./icons/guard_success.png").then(img =>{
            return img
        }),
        loadImage(avatar).then(img =>{
            return img
        }),
        loadImage("./icons/race_0.png").then(img =>{
            return img
        }),
        loadImage("./icons/race_1.png").then(img =>{
            return img
        }),
        loadImage("./icons/race_2.png").then(img =>{
            return img
        }),
        loadImage("./icons/race_3.png").then(img =>{
            return img
        }),
        loadImage("./icons/weapon_0.png").then(img =>{
            return img
        }),
        loadImage("./icons/weapon_1.png").then(img =>{
            return img
        }),
        loadImage("./icons/weapon_2.png").then(img =>{
            return img
        }),
        loadImage("./icons/weapon_3.png").then(img =>{
            return img
        })
    ]
    for(var i = 0; i < 6;i++){
        imagePromises.push(
            loadImage("./icons/typeIcon_" + i + ".png").then(img =>{
                return img
            })
        )
    }
    
    Promise.all(imagePromises).then((values) =>{
        images.icon = values[0]
        images.atk = values[0]
        images.spatk = values[1]
        images.guardatk = values[2]
        images.guardspatk = values[3]
        images.attack_accuracy = values[4]
        images.attack_critical = values[5]
        images.attack_speed = values[6]
        images.guard_counter = values[7]
        images.guard_success= values[8]
        images.avatar = values[9]



        ctx.fillStyle = "#23272A"
        ctx.fillRect(0,0,1440,720)

        ctx.fillStyle = "#000000"

        ctx.lineWidth = 10;
        toggleShadows(true);
        ctx.beginPath();
        ctx.moveTo(50,50);
        ctx.lineTo(350,50);
        ctx.lineTo(350,450);
        ctx.lineTo(200,650);
        ctx.lineTo(50,450);
        ctx.lineTo(50,50);
        ctx.closePath();
        ctx.stroke();
        toggleShadows(false);
        
        ctx.lineWidth = 5;
        
        ctx.fillStyle = '#7289DA';
        ctx.fill();

        ctx.fillStyle = "#000000"

        drawAbilityBox(player.abilities[0],450,25);
        drawAbilityBox(player.abilities[1],450,225);
        drawAbilityBox(player.abilities[2],800,25);
        drawAbilityBox(player.abilities[3],800,225);
        drawAbilityBox(player.abilities[4],1150,25);
        drawAbilityBox(player.abilities[5],1150,225);

        toggleShadows(true)
        ctx.fillStyle = '#6473A6';
        ctx.strokeRect(450, 425, 400, 275);
        ctx.fillRect(450, 425, 400, 275);
        ctx.strokeRect(1000, 425, 400, 275);
        ctx.fillRect(1000, 425, 400, 275);
        toggleShadows(false)
        
        ctx.fillStyle = "#000000"
        
        ctx.font = '30px Impact'
        ctx.textAlign = "center"
        
        
        ctx.fillText("HP",650,455)
        ctx.fillText("ATK",525,500)
        ctx.fillText("SP ATK",525,600)
        ctx.fillText("DEF",775,500)
        ctx.fillText("SP DEF",775,600)
        ctx.fillText("SPD",650,650)
        
        
        ctx.font = '28px Impact'
        ctx.fillStyle = "#5751FF"
        ctx.fillText(player.stats.hp,650,495)
        ctx.fillStyle = "#B83A3A"
        ctx.fillText(player.stats.atk,525,540)
        ctx.fillStyle = "#D5C035"
        ctx.fillText(player.stats.spatk,525,640)
        ctx.fillStyle = "#4D934F"
        ctx.fillText(player.stats.def,775,540)
        ctx.fillStyle = "#D6943C"
        ctx.fillText(player.stats.spdef,775,640)
        ctx.fillStyle = "#91E1DE"
        ctx.fillText(player.stats.spd,650,690)
        
        ctx.fillStyle = "#000000"
        
        ctx.font = '30px Impact'
        ctx.textAlign = "center"
        ctx.fillText("Level",1200,475)
        ctx.fillText("Skillpoints",1100,570)
        ctx.fillText("Experience",1300,570)
        ctx.fillText("Lives",1200,650)
        
        ctx.font = '28px Impact'
        ctx.fillText(player.level,1200,515)
        ctx.fillText(player.skillpoints,1100,610)
        ctx.fillText(player.exp,1300,610)
        ctx.fillText(player.lives,1200,690)
        
        ctx.font = '48px Impact'
        ctx.drawImage(images.avatar, 136, 100,128,128);
        ctx.drawImage(images.icon, 168, 375,64,64);
        ctx.fillText(player.name,200,300)

        const fs = require('fs')
        let path = __dirname + '/' + player.id + '.png'
        const out = fs.createWriteStream(path)
        const stream = canvas.createPNGStream()
        stream.pipe(out)
        out.on('finish', () =>  {
            console.log('The PNG file was created.')
            callback(path)
        })
    })
}




module.exports = {
    drawCard(player,avatar,callback){
        makeCard(player,avatar,callback)
    }
}