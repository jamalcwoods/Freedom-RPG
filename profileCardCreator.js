const { createCanvas, registerFont, loadImage } = require('canvas')
const { clone } = require('./tools.js')
const data = {raceIndex, combatStyleIndex, scoreModifiers} = require('./data.json')
registerFont('./fonts/Oswald-VariableFont_wght.ttf', { family: 'Oswald Light' })

let images = {}

function toggleShadows(ctx,toggle){
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

function drawAbilityBox(ctx,ability,x,y,signature){
    toggleShadows(ctx,true);
    ctx.fillStyle = '#7289DA';
    ctx.strokeRect(x, y, 250, 175);
    ctx.fillRect(x, y, 250, 175);
    toggleShadows(ctx,false);

    ctx.fillStyle = '#000000';

    if(ability != undefined){
        ctx.font = '30px "Oswald Light"'
        ctx.textAlign = "left"
        if(signature){
            ctx.fillText(ability.name + "(S)",x + 5,y+30)    
        } else {
            ctx.fillText(ability.name,x + 5,y+30)
        }
        let speedText;
        switch(ability.action_type){
            case "attack":
                ctx.textAlign = "left"

                ctx.drawImage(images[ability.damage_type], x + 40, y + 49,32,32);
                ctx.fillText("Damage: " + ability.damage_val,x + 75,y + 77)
                
                ctx.textAlign = "center"
                speedText = ""
                switch(parseInt(ability.speed)){
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
                    case 4:
                        speedText = "Early"
                        break;
                }

                ctx.font = '18px "Oswald Light"'

                ctx.drawImage(images.attack_accuracy, x + 37, y + 132,18,18);
                ctx.fillText(ability.accuracy + "%",x +47,y + 167)

                ctx.drawImage(images.attack_recoil, x + 77, y + 87,18,18);
                ctx.fillText(ability.recoil,x +87,y + 123)
                
                ctx.drawImage(images.attack_speed, x + 117, y + 132,18,18);
                ctx.fillText(speedText,x + 127,y + 167)

                ctx.drawImage(images.attack_numHits, x + 157, y + 87,18,18);
                ctx.fillText(ability.numHits,x + 167,y + 123)
                
                ctx.drawImage(images.attack_critical, x + 197, y + 132,18,18);
                ctx.fillText(ability.critical + "%",x + 207,y + 167)
                
                // Faction Icon - Disabled for now 
                //ctx.drawImage(images.icon, x + 170, y + 3,32,32);

                let targetIcon;
                switch(ability.targetType){
                    case "1":
                        targetIcon = "stats_target_2"
                        break;

                    case "2":
                        targetIcon = "stats_target_4"
                        break;

                    case "3":
                        targetIcon = "stats_target_3"
                        break;
                }
                ctx.drawImage(images[targetIcon], x + 212, y + 3,32,32);
                break;
                
            case "guard":
                ctx.textAlign = "left"
                ctx.drawImage(images[ability.guard_type], x + 40, y + 69,32,32);
                ctx.fillText("Guard: " + ability.guard_val,x + 75,y + 97)
                
                ctx.textAlign = "center"
                ctx.font = '24px "Oswald Light"'
                ctx.drawImage(images["guard_counter_" + ability.counter_type], x + 26, y + 106,32,32);
                ctx.fillText(ability.counter_val,x +45,y + 165)
                
                ctx.drawImage(images.guard_success, x + 186, y + 106,32,32);
                ctx.fillText(ability.success_level,x + 205,y + 165)
                break;

            case "stats":

                ctx.textAlign = "center"

                speedText = ""
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

                ctx.font = '18px "Oswald Light"'
                ctx.drawImage(images.attack_speed, x + 192, y,32,32);
                ctx.fillText(speedText,x + 207, y + 40)

                ctx.textAlign = "left"

                let coords = []
                let targetImgSize;
                switch(ability.effects.length){
                    case 1:
                        coords = [[x + 93, y + (175/2)]]
                        targetImgSize = 64
                        break;

                    case 2:
                        coords = [
                            [x + 53, y + (175/2)],
                            [x + 157, y + (175/2)]
                        ]
                        targetImgSize = 48
                        break;

                    case 3:
                        coords = [
                            [x + 30, y + (175/2)],
                            [x + 117, y + (175/2)],
                            [x + 197, y + (175/2)]
                        ]
                        targetImgSize = 36
                        break;
                }
                ctx.font = targetImgSize/2 + 'px "Oswald Light"'
                for(let i = 0; i < ability.effects.length;i++){
                    ctx.drawImage(images["stats_target_" + ability.effects[i].target], coords[i][0], coords[i][1],targetImgSize,targetImgSize);
                    if(ability.effects[i].value > 0){
                        ctx.drawImage(images.stats_increase, coords[i][0] - targetImgSize/4, coords[i][1] - targetImgSize/2,targetImgSize/2,targetImgSize/2);
                    } else {
                        ctx.drawImage(images.stats_decrease, coords[i][0] - targetImgSize/4, coords[i][1] - targetImgSize/2,targetImgSize/2,targetImgSize/2);
                    }
                    ctx.fillText(Math.abs(ability.effects[i].value) + " " + ability.effects[i].stat.toUpperCase(),coords[i][0] + targetImgSize/4, coords[i][1])
                }
                
                break;
        }
    } else {
        ctx.font = '30px "Oswald Light"'
        ctx.textAlign = "center"
        ctx.fillText("No Ability",x + 125,y + 175/2)
    }
}

function makeCard(player,avatar,page,callback){
    const canvas = createCanvas(1440, 720)
    const ctx = canvas.getContext('2d')
    let imagePromises;
    switch(page){
        case "stats":
            imagePromises = [
                loadImage("./icons/default.png").then(img =>{
                    return img
                }),
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
                loadImage("./icons/attack_numHits.png").then(img =>{
                    return img
                }),
                loadImage("./icons/attack_recoil.png").then(img =>{
                    return img
                }),
                loadImage("./icons/guard_counter_def.png").then(img =>{
                    return img
                }),
                loadImage("./icons/guard_counter_spdef.png").then(img =>{
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
                }),
                loadImage("./icons/stats_target_0.png").then(img =>{
                    return img
                }),
                loadImage("./icons/stats_target_1.png").then(img =>{
                    return img
                }),
                loadImage("./icons/stats_target_2.png").then(img =>{
                    return img
                }),
                loadImage("./icons/stats_target_3.png").then(img =>{
                    return img
                }),
                loadImage("./icons/stats_target_4.png").then(img =>{
                    return img
                }),
                loadImage("./icons/stats_increase.png").then(img =>{
                    return img
                }),
                loadImage("./icons/stats_decrease.png").then(img =>{
                    return img
                })
            ]
            // for(var i = 0; i < 6;i++){
            //     imagePromises.push(
            //         loadImage("./icons/typeIcon_" + i + ".png").then(img =>{
            //             return img
            //         })
            //     )
            // }
            
            Promise.all(imagePromises).then((values) =>{
                images.icon = values[0]
                images.atk = values[1]
                images.spatk = values[2]
                images.def = values[3]
                images.spdef = values[4]
                images.attack_accuracy = values[5]
                images.attack_critical = values[6]
                images.attack_speed = values[7]
                images.attack_numHits = values[8]
                images.attack_recoil = values[9]
                images.guard_counter_def = values[10]
                images.guard_counter_spdef = values[11]
                images.guard_success= values[12]
                images.avatar = values[13]
                images.race0 = values[14]
                images.race1 = values[15]
                images.race2 = values[16]
                images.race3 = values[17]
                images.weapon0 = values[18]
                images.weapon1 = values[19]
                images.weapon2 = values[20]
                images.weapon3 = values[21]
                images.stats_target_0 = values[22]
                images.stats_target_1 = values[23]
                images.stats_target_2 = values[24]
                images.stats_target_3 = values[25]
                images.stats_target_4 = values[26]
                images.stats_increase = values[27]
                images.stats_decrease = values[28]
                
        
                ctx.fillStyle = "#23272A"
        
                ctx.fillStyle = "#000000"
        
                ctx.lineWidth = 10;
                toggleShadows(ctx,true);
                ctx.beginPath();
                ctx.moveTo(50,50);
                ctx.lineTo(350,50);
                ctx.lineTo(350,450);
                ctx.lineTo(200,650);
                ctx.lineTo(50,450);
                ctx.lineTo(50,50);
                ctx.closePath();
                ctx.stroke();
                toggleShadows(ctx,false);
                
                ctx.lineWidth = 5;
                
                ctx.fillStyle = '#7289DA';
                ctx.fill();
        
                ctx.fillStyle = "#000000"
                
                if(player.signature){
                    drawAbilityBox(ctx,player.abilities[4],490,225);
                    drawAbilityBox(ctx,player.signature,755,225,true);
                    drawAbilityBox(ctx,player.abilities[5],1020,225);

                    drawAbilityBox(ctx,player.abilities[0],365,25);
                    drawAbilityBox(ctx,player.abilities[1],630,25);
                    drawAbilityBox(ctx,player.abilities[2],895,25);
                    drawAbilityBox(ctx,player.abilities[3],1160,25);   
                } else {
                    drawAbilityBox(ctx,player.abilities[0],450,25);
                    drawAbilityBox(ctx,player.abilities[1],450,225);
                    drawAbilityBox(ctx,player.abilities[2],800,25);
                    drawAbilityBox(ctx,player.abilities[3],800,225);
                    drawAbilityBox(ctx,player.abilities[4],1150,25);
                    drawAbilityBox(ctx,player.abilities[5],1150,225);
                }
        
                toggleShadows(ctx,true)
                ctx.fillStyle = '#7289DA';
                ctx.strokeRect(450, 425, 400, 275);
                ctx.fillRect(450, 425, 400, 275);
                ctx.strokeRect(1000, 425, 400, 275);
                ctx.fillRect(1000, 425, 400, 275);
                toggleShadows(ctx,false)
                
                ctx.fillStyle = "#000000"
                
                ctx.font = '30px "Oswald Light"'
                ctx.textAlign = "center"
            
                ctx.fillText("HP",650,455)
                ctx.fillText("ATK",525,500)
                ctx.fillText("SP ATK",525,600)
                ctx.fillText("DEF",775,500)
                ctx.fillText("SP DEF",775,600)
                ctx.fillText("SPD",650,650)
                ctx.fillText("LEVEL",650,550)
                
                let playerStats = clone(player.stats)
        
                if(player.inventory){
                    if(player.gear != undefined){
                        let fGear = player.inventory[player.gear]
                        for(s in fGear.stats){
                            if(s == "hp"){
                                playerStats[s] += fGear.stats[s] * 2
                            } else {
                                playerStats[s] += fGear.stats[s] 
                            }
                            if(playerStats[s] < 1){
                                playerStats[s] = 1
                            }
                        }
                    }
                    if(player.weapon != undefined){
                        let fWeapon = player.inventory[player.weapon]
                        for(s in fWeapon.stats){
                            if(s == "hp"){
                                playerStats[s] += fWeapon.stats[s] * 2
                            } else {
                                playerStats[s] += fWeapon.stats[s] 
                            }
                            if(playerStats[s] < 1){
                                playerStats[s] = 1
                            }
                        }
                    }
                }
        
                ctx.font = '28px "Oswald Light"'
                ctx.fillStyle = "#5751FF"
                ctx.fillText(playerStats.hp,650,495)
                ctx.fillStyle = "#B83A3A"
                ctx.fillText(playerStats.atk,525,540)
                ctx.fillStyle = "#D5C035"
                ctx.fillText(playerStats.spatk,525,640)
                ctx.fillStyle = "#4D934F"
                ctx.fillText(playerStats.def,775,540)
                ctx.fillStyle = "#D6943C"
                ctx.fillText(playerStats.spdef,775,640)
                ctx.fillStyle = "#91E1DE"
                ctx.fillText(playerStats.spd,650,690)
                ctx.fillStyle = "#000000"
                ctx.fillText(player.level,650,590)
                
                ctx.font = '30px "Oswald Light"'
                ctx.textAlign = "center"
                ctx.fillText("Ability Points",1100,475)
                ctx.fillText("Skill Points",1300,475)
                ctx.fillText("Experience: " + player.exp + "/" + player.expCap,1200,570)
                ctx.fillText("Lives",1100,650)
                ctx.fillText("Gold",1300,650)
                
                ctx.font = '28px "Oswald Light"'
                ctx.fillText(player.abilitypoints,1100,515)
                ctx.fillText(player.statpoints,1300,515)
                ctx.fillText(player.lives,1100,690)
                ctx.fillText(player.gold,1300,690)
                
                
                ctx.drawImage(images.avatar, 136, 100,128,128);
                if(player.name.length > 10){
                    ctx.font = 48/(player.name.length/10) + 'px "Oswald Light"'
                } else {
                    ctx.font = '48px "Oswald Light"'
                }
                
                ctx.fillText(player.name,200,280)
        
                ctx.font = '32px "Oswald Light"'
                ctx.fillText("Wearing:",200,340)
                ctx.fillText("Wielding:",200,410)
        
                ctx.font = '18px "Oswald Light"'
                if(player.gear != undefined && player.gear >= 0){
                    ctx.fillText(player.inventory[player.gear].name,200,370)
                } else {
                    ctx.fillText("Basic Gear",200,370)
                }
        
                if(player.weapon != undefined && player.weapon >= 0){
                    ctx.fillText(player.inventory[player.weapon].name,200,440)
                } else {
                    ctx.fillText("Basic Weapon",200,440)
                }
        
                let raceText = ""
                for(r of raceIndex){
                    if(r.id == player.race){
                        raceText = r.name
                        break;
                    }
                }
                let weaponText = ""
                for(r of combatStyleIndex){
                    if(r.id == player.combatStyle){
                        weaponText = r.name
                        break;
                    }
                }
                ctx.font = '20px "Oswald Light"'
                ctx.fillText(raceText,160, 490)
                ctx.drawImage(images["race" + player.race], 128, 495,64,64);
                ctx.fillText(weaponText,240, 490)
                ctx.drawImage(images["weapon" + player.combatStyle], 208, 495,64,64);
                
                
        
                const fs = require('fs')
                let path = __dirname + '/profiles/' + player.id + '.png'
                const out = fs.createWriteStream(path)
                const stream = canvas.createPNGStream()
                stream.pipe(out)
                out.on('finish', () =>  {
                    callback(path)
                })
            })
            break;
        
        case "achievements":
            imagePromises = [
                loadImage(avatar).then(img =>{
                    return img
                })
            ]
            Promise.all(imagePromises).then((values) =>{
                images.avatar = values[0]
                ctx.lineWidth = 5;
                toggleShadows(ctx,true);
                ctx.fillStyle = '#7289DA';
                ctx.strokeRect(120, 120, 1200, 500);
                ctx.fillRect(120, 120, 1200, 500);
                toggleShadows(ctx,false);


                ctx.drawImage(images.avatar, 590, 235,256,256);
                ctx.textAlign = "center"
                ctx.fillStyle = '#000000';
                
                if(player.name.length > 10){
                    ctx.font = 60/(player.name.length/10) + 'px "Oswald Light"'
                } else {
                    ctx.font = '60px "Oswald Light"'
                }
                ctx.fillText(player.name + "'s",720, 175)

                ctx.font = '36px "Oswald Light"'
                ctx.fillText("Achievements",720, 225)
                
                ctx.fillText("Kills",380,200)
                ctx.fillText(player.achievements.kills,380,240)
                ctx.fillText("Abilities Used",380,315)
                ctx.fillText(player.achievements.abilitiesUsed,380,355)
                ctx.fillText("Lives Lost",380,430)
                ctx.fillText(player.achievements.livesLost,380,470)
                ctx.fillText("Tasks Completed",380,545)
                ctx.fillText(player.achievements.tasksCompleted,380,585)
                ctx.fillText("Strongest Attack",1060,200)
                ctx.fillText(player.achievements.strongestAttack,1060,240)
                ctx.fillText("Dungeon Clears",1060,315)
                ctx.fillText(player.achievements.dungeonsCleared,1060,355)
                ctx.fillText("Raid Leader Kills",1060,430)
                ctx.fillText(player.achievements.raidLeaderKills,1060,470)
                ctx.fillText("Player Battles Won",1060,545)
                ctx.fillText(player.achievements.playerBattlesWon,1060,585)

                let score = 0 

                for(stat in player.achievements){
                    if(scoreModifiers[stat] != undefined){
                        score += scoreModifiers[stat] * player.achievements[stat]
                    }
                }

                ctx.fillText("Score",720,545)
                ctx.fillText(score,720,585)
            
                const fs = require('fs')
                let path = __dirname + '/profiles/' + player.id + '.png'
                const out = fs.createWriteStream(path)
                const stream = canvas.createPNGStream()
                stream.pipe(out)
                out.on('finish', () =>  {
                    callback(path)
                })
            })
            break;
    }
    
}




module.exports = {
    drawCard(player,avatar,page,callback){
        makeCard(player,avatar,page,callback)
    }
}