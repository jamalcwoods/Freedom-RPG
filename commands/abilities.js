const { SlashCommandBuilder } = require('@discordjs/builders');
const { populateAbilityCreatorButtons, populateAbilityCreatorWindow, populateManegeAbilityWindow, populateManageAbilityControls } = require("../sessionTools.js")
const { clone } = require("../tools.js")
const data = require("../data.json")


module.exports = {

	data: new SlashCommandBuilder()
		.setName('abilities')
		.setDescription('Manage abilities')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new ability for your character to learn')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name of the new ability')
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('manage')
                .setDescription('View, remove, and/or add abilities')
        ),
    config:{
        getPlayerData:true
    },
	async execute(interaction,config,callback) {
        let playerData = config.playerData
        switch(interaction.options["_subcommand"]){
            case "create": 
                let message = " "
                let choices = config.choices
                if(!playerData.abilities){
                    playerData.abilities = []
                }
                if(playerData.abilities.length < 6){
                    let newSession = {
                        type:"makeAbility",
                        session_id: Math.floor(Math.random() * 100000),
                        user_ids:[playerData.id],
                        session_data:{
                            abilities:playerData.abilities,
                            ability:clone(data.templates.attack),
                            faction:playerData.faction,
                            abilitypoints:playerData.abilitypoints,
                            level:playerData.level,
                            weapon:playerData.combatStyle,
                            race:playerData.race,
                            permissions:playerData.abilityPermissions,
                            editingAttribute:"action_type",
                        }
                    }

                    if(playerData.tutorial == 3){
                        let offStat = playerData.stats.atk > playerData.stats.spatk ? "atk" : "spatk"
                        message = "The menu below allows you to create a your very own ability to use in combat.\nTo get you started, let's have you create a basic attack that simply has a base damage of 20.\n\nTo do this, click on the drop down and select `damage_val`. Then use the buttons to adjust the 'Current Value' to 20.\n\nYou're also going to want to make sure that this ability deals damage using your highest offensive stat which is **" + offStat + "**. To make sure of that, select `damage_type` on the dropdown and make sure that **" + offStat + "** is selected.\n\nOnce you are done, click the 'Add Ability' button"
                        newSession.session_data.tutorialMsg = message
                        newSession.session_data.tutorialDmgType = offStat
                        newSession.session_data.tutorial = 1
                    } else if(playerData.tutorial == 4){
                        message = "This time you are going to want to do the following:\n\nChange the **action_type** to **guard**\nChange the **guard_val** to **30**\nChange the **counter_val** to **15**\nMake sure **guard_type** is set to **def**\n\nOnce you are done, click the 'Add Ability' button"
                        newSession.session_data.tutorialMsg = message
                        newSession.session_data.tutorialGuardType = "def"
                        newSession.session_data.tutorial = 2
                    } else if(playerData.tutorial == 'completed'){
                        newSession.session_data.ability.name = choices[0].value
                        
                        interaction.reply({
                                content: message,
                                components: populateAbilityCreatorButtons(newSession),
                                embeds: populateAbilityCreatorWindow(newSession)
                        })
                        callback({
                            addSession:newSession
                        })
                    } else {
                        interaction.reply({ content: "You must complete the tutorial before accessing this command. For help seeing what's next to do, perform the `/tutorial` command", ephemeral: true });    
                    }
                } else {
                    interaction.reply({ content: 'You already have the maximum number of abilities!', ephemeral: true });
                    callback({})
                }
                break;

            case "manage":

                let newSession = {
                    type:"manageAbilities",
                    session_id: Math.floor(Math.random() * 100000),
                    user_ids:[playerData.id],
                    session_data:{
                        player:playerData
                    }
                }
            
                interaction.reply({
                    content:" ",
                    embeds:populateManegeAbilityWindow(newSession),
                    components:populateManageAbilityControls(newSession)
                })
        
                callback({
                    addSession:newSession
                })
                break;
        }
	},
};