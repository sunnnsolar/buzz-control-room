# Control room (Buzz plugin)

A read-only page in Buzz that shows how Sunnn is going today and over the last 7 days: new leads, minutes to first call, calls made, 10-minute calls and PV Designs booked, PV meetings held, proposals sent (and how many had no follow-up in 48 h), signed jobs, open installs by step, and what is waiting on James.

The page holds no data and no credentials. Its numbers come from one local, hash-pinned reader command (`~/.buzz/bin/sunnn-control-room-read`) on the Mac it runs on; if that reader is missing or changed, Buzz refuses to run it and every tile says "not measured".
