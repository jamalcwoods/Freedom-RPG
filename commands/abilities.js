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
                            editingAttribute:"action_type"
                        }
                    }
        
                    newSession.session_data.ability.name = choices[0].value
                    
                    interaction.reply({
                            content: " ",
                            components: populateAbilityCreatorButtons(newSession),
                            embeds: populateAbilityCreatorWindow(newSession)
                    })
                    callback({
                        addSession:newSession
                    })
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