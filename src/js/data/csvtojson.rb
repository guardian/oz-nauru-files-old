require 'json'
require 'csv'

puts "input file dir"
input = STDIN.gets.chomp

puts "output file dir"
output = STDIN.gets.chomp

csv = CSV.read(input, headers:true).map{|row| row.to_hash}

p csv
File.open(output, "w") do |f|
  f.write(csv.to_json)
end