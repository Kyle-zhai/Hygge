import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

interface PlanCardProps {
  name: string;
  price: string;
  perMonth: string;
  features: string[];
  isCurrent: boolean;
  isPopular?: boolean;
  currentPlanLabel: string;
  upgradeLabel: string;
  popularLabel: string;
}

export function PlanCard({
  name,
  price,
  perMonth,
  features,
  isCurrent,
  isPopular,
  currentPlanLabel,
  upgradeLabel,
  popularLabel,
}: PlanCardProps) {
  return (
    <Card className={`relative ${isPopular ? "border-primary shadow-md" : ""}`}>
      {isPopular && (
        <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
          {popularLabel}
        </Badge>
      )}
      <CardHeader className="text-center">
        <CardTitle className="text-xl">{name}</CardTitle>
        <div className="mt-2">
          <span className="text-4xl font-bold">{price}</span>
          {price !== "$0" && <span className="text-muted-foreground">{perMonth}</span>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {feature}
            </li>
          ))}
        </ul>
        <Button className="w-full" variant={isCurrent ? "outline" : "default"} disabled={isCurrent}>
          {isCurrent ? currentPlanLabel : upgradeLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
