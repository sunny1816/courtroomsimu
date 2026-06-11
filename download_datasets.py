from datasets import load_dataset

print("Downloading SNLI...")
snli = load_dataset("stanfordnlp/snli")

print("Downloading MultiNLI...")
mnli = load_dataset("nyu-mll/multi_nli")

print("Done!")



print(snli)
print(snli["train"][0])