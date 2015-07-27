$(document).ready(function(){
	//time virtualizer stuff
	require('../lib/TimeVirtualizer');

	timeVirtualizer.virtualize();
	var advanceMS = 10;
	//Slowing down/speeding up time is achieved through changing this variable
	advanceTime = function () {
		timeVirtualizer.advanceTimeMS(advanceMS);
	}
	//Every 10ms the time is advanced for 'advanceMS' milliseconds, thus, changing this variable
	//can change the speed of ingame time
	var intervalId = timeVirtualizer._reals.setInterval.call(window, advanceTime, 10);

	//Snake game code mostly taken from 
	//http://thecodeplayer.com/walkthrough/html5-game-tutorial-make-a-snake-game-using-html5-canvas-jquery

	//Canvas stuff
	var canvas = $("#canvas")[0];
	var ctx = canvas.getContext("2d");
	var w = $("#canvas").width();
	var h = $("#canvas").height();
	
	var cw = 10;
	var d;
	var food;
	var score;
	
	var snake_array; //an array of cells to make up the snake
	
	function init()
	{
		d = "right"; //default direction
		create_snake();
		create_food();
		score = 0;
		
		if(typeof game_loop != "undefined") clearInterval(game_loop);
		game_loop = setInterval(paint, 60);
	}
	init();
	
	function create_snake()
	{
		var length = 5;
		snake_array = [];
		for(var i = length-1; i>=0; i--)
		{
			snake_array.push({x: i, y:0});
		}
	}
	
	//Lets create the food now
	function create_food()
	{
		food = {
			x: Math.round(Math.random()*(w-cw)/cw), 
			y: Math.round(Math.random()*(h-cw)/cw), 
		};
	}
	
	function paint()
	{
		//To avoid the snake trail we need to paint the BG on every frame
		ctx.fillStyle = "white";
		ctx.fillRect(0, 0, w, h);
		ctx.strokeStyle = "black";
		ctx.strokeRect(0, 0, w, h);
		
		var nx = snake_array[0].x;
		var ny = snake_array[0].y;
		
		if(d == "right") nx++;
		else if(d == "left") nx--;
		else if(d == "up") ny--;
		else if(d == "down") ny++;
		
		//This will restart the game if the snake hits the wall or bumps into its body
		if(nx == -1 || nx == w/cw || ny == -1 || ny == h/cw || check_collision(nx, ny, snake_array))
		{
			//restart game
			init();
			return;
		}
		
		//The movement code
		//The logic is simple
		//If the new head position matches with that of the food,
		//create a new head instead of moving the tail.
		//If not, pop out the tail cell and place it in front of the head cell
		if(nx == food.x && ny == food.y)
		{
			var tail = {x: nx, y: ny};
			score++;
			//Create new food
			create_food();
		}
		else
		{
			var tail = snake_array.pop(); //pops out the last cell
			tail.x = nx; tail.y = ny;
		}

		snake_array.unshift(tail); //puts back the tail as the first cell
		
		for(var i = 0; i < snake_array.length; i++)
		{
			var c = snake_array[i];
			//Lets paint 10px wide cells
			paint_cell(c.x, c.y);
		}
		
		//Lets paint the food
		paint_cell(food.x, food.y);
		//Lets paint the score
		var score_text = "Score: " + score;
		ctx.fillText(score_text, 5, h-5);
		//Lets paint the speed of the game
		var speed_text = "Speed: " + advanceMS*10 + "% of normal";
		ctx.fillText(speed_text, 50, h-5);
	}
	
	function paint_cell(x, y)
	{
		ctx.fillStyle = "blue";
		ctx.fillRect(x*cw, y*cw, cw, cw);
		ctx.strokeStyle = "white";
		ctx.strokeRect(x*cw, y*cw, cw, cw);
	}
	
	function check_collision(x, y, array)
	{
		//This function will check if the provided x/y coordinates exist
		//in an array of cells or not
		for(var i = 0; i < array.length; i++)
		{
			if(array[i].x == x && array[i].y == y)
			 return true;
		}
		return false;
	}
	
	//Keyboard controls
	$(document).keydown(function(e){
		var key = e.which;
		//Movement control
		if(key == "37" && d != "right") d = "left";
		else if(key == "38" && d != "down") d = "up";
		else if(key == "39" && d != "left") d = "right";
		else if(key == "40" && d != "up") d = "down";

		//Speed control
		if (key == "90" && advanceMS > 1) {
			console.log("time down");
			advanceMS--;
		} else if (key == "88" && advanceMS < 20) {
			console.log("time up");
			advanceMS++;
		}
	})
});
